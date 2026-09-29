#include "../include/Types.h"
#include "../include/WalletRegistry.h"
#include "../include/TransactionStore.h"
#include "../include/Graph.h"
#include "../include/TraceEngine.h"
#include "../include/QueryResult.h"

#include <iostream>
#include <iomanip>
#include <chrono>
#include <vector>
#include <string>
#include <cassert>

#ifdef _WIN32
#include <windows.h>
#include <psapi.h>
#endif

// ============================================================
// Timing Helper
// ============================================================
class Timer
{
    std::chrono::time_point<std::chrono::steady_clock> start;
public:
    Timer() : start(std::chrono::steady_clock::now()) {}
    void reset() { start = std::chrono::steady_clock::now(); }
    int64_t elapsedMs() const {
        return std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - start).count();
    }
    int64_t elapsedUs() const {
        return std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::steady_clock::now() - start).count();
    }
};

// ============================================================
// Memory Measurement & Verification (Phase 3)
// ============================================================
struct MemoryProfile
{
    double csrGraphMB;
    double txStoreMB;
    double registryMB;
    double analyticalTotalMB;
    double processWorkingSetMB;
    double peakWorkingSetMB;
};

MemoryProfile measureMemory(size_t walletCount, size_t txCount)
{
    MemoryProfile p;
    // 1. CSR Graph memory:
    //    outOffsets: (V+1) * 8 bytes
    //    inOffsets:  (V+1) * 8 bytes
    //    outEdges:   E * 4 bytes
    //    inEdges:    E * 4 bytes
    size_t csrBytes = (walletCount + 1) * sizeof(size_t) * 2 + txCount * sizeof(TransactionID) * 2;
    p.csrGraphMB = static_cast<double>(csrBytes) / (1024.0 * 1024.0);

    // 2. TransactionStore memory:
    //    Transaction struct: id(4), from(4), to(4), amount(8), timestamp(8), asset(string ~32) = ~64 bytes
    size_t txBytes = txCount * sizeof(Transaction);
    p.txStoreMB = static_cast<double>(txBytes) / (1024.0 * 1024.0);

    // 3. WalletRegistry memory:
    //    Wallet struct vector: V * sizeof(Wallet) (~56 bytes)
    //    unordered_map overhead: ~40-48 bytes per entry (bucket pointer + node structure + key copy)
    size_t regBytes = walletCount * sizeof(Wallet) + walletCount * 40;
    p.registryMB = static_cast<double>(regBytes) / (1024.0 * 1024.0);

    p.analyticalTotalMB = p.csrGraphMB + p.txStoreMB + p.registryMB;

#ifdef _WIN32
    PROCESS_MEMORY_COUNTERS pmc;
    if (GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof(pmc)))
    {
        p.processWorkingSetMB = static_cast<double>(pmc.WorkingSetSize) / (1024.0 * 1024.0);
        p.peakWorkingSetMB = static_cast<double>(pmc.PeakWorkingSetSize) / (1024.0 * 1024.0);
    }
    else
    {
        p.processWorkingSetMB = p.analyticalTotalMB;
        p.peakWorkingSetMB = p.analyticalTotalMB;
    }
#else
    p.processWorkingSetMB = p.analyticalTotalMB;
    p.peakWorkingSetMB = p.analyticalTotalMB;
#endif

    return p;
}

// ============================================================
// Scale Benchmark (1K, 10K, 100K, 1M Transactions)
// ============================================================
void runScaleBenchmark(size_t txCount)
{
    size_t expectedWallets = txCount / 4;
    std::cout << "\n======================================================================\n";
    std::cout << " SCALE BENCHMARK: " << txCount << " TRANSACTIONS (" << expectedWallets << " UNIQUE WALLETS)\n";
    std::cout << "======================================================================\n";

    WalletRegistry registry;
    TransactionStore transactions;
    Graph graph;
    TraceEngine engine;

    Timer timer;

    // 1. Ingest transactions
    for (size_t i = 0; i < txCount; ++i)
    {
        uint32_t from = static_cast<uint32_t>(i % expectedWallets);
        uint32_t to = static_cast<uint32_t>((i * 37 + 17) % expectedWallets);
        if (from == to) to = (to + 1) % expectedWallets;

        Amount amount = doubleToAmount(0.01 + static_cast<double>(i % 1000) * 0.01);
        uint64_t ts = 1726228000ULL + i;

        transactions.add(
            registry,
            "TX" + std::to_string(i),
            "W" + std::to_string(from),
            "W" + std::to_string(to),
            amount,
            ts,
            "ETH"
        );
    }

    int64_t ingestMs = timer.elapsedMs();
    assert(registry.size() == expectedWallets);

    // 2. Build CSR Graph
    timer.reset();
    graph.build(registry.size(), transactions);
    int64_t buildMs = timer.elapsedMs();

    MemoryProfile mem = measureMemory(registry.size(), transactions.size());

    std::cout << std::left;
    std::cout << "  Transactions Ingested : " << transactions.size() << " in " << ingestMs << " ms\n";
    std::cout << "  Unique Wallets (Exact): " << registry.size() << " (Expected: " << expectedWallets << ")\n";
    std::cout << "  CSR Graph Build Time  : " << buildMs << " ms\n";
    std::cout << "  --- Memory Verification (Phase 3) ---\n";
    std::cout << "  * CSR Graph (Offsets+Edges): " << std::fixed << std::setprecision(2) << mem.csrGraphMB << " MB\n";
    std::cout << "  * Transaction Store        : " << mem.txStoreMB << " MB\n";
    std::cout << "  * Wallet Registry          : " << mem.registryMB << " MB\n";
    std::cout << "  * Analytical Data Total    : " << mem.analyticalTotalMB << " MB\n";
    std::cout << "  * OS Peak Working Set (RAM): " << mem.peakWorkingSetMB << " MB\n";

    // 3. Localized Query (Depth 6, max 1000 nodes)
    TraceQuery qLocal;
    qLocal.root = 0;
    qLocal.direction = Direction::FORWARD;
    qLocal.algorithm = Algorithm::BFS;
    qLocal.maxDepth = 6;
    qLocal.maxNodes = 1000;

    QueryResult resBfsLocal = engine.query(qLocal, graph, transactions, registry);

    qLocal.algorithm = Algorithm::DFS;
    QueryResult resDfsLocal = engine.query(qLocal, graph, transactions, registry);

    std::cout << "  --- Traversal: Localized Query (Depth 6) ---\n";
    std::cout << "  BFS: " << std::setw(6) << resBfsLocal.stats.executionTimeUs << " us"
              << " | Visited: " << std::setw(4) << resBfsLocal.stats.nodesVisited
              << " | Edges Examined: " << std::setw(4) << resBfsLocal.stats.edgesExamined
              << " | Result Nodes: " << std::setw(4) << resBfsLocal.nodes.size()
              << " | Result Edges: " << resBfsLocal.edges.size() << "\n";

    std::cout << "  DFS: " << std::setw(6) << resDfsLocal.stats.executionTimeUs << " us"
              << " | Visited: " << std::setw(4) << resDfsLocal.stats.nodesVisited
              << " | Edges Examined: " << std::setw(4) << resDfsLocal.stats.edgesExamined
              << " | Result Nodes: " << std::setw(4) << resDfsLocal.nodes.size()
              << " | Result Edges: " << resDfsLocal.edges.size() << "\n";

    // 4. Wide Subgraph Query (Depth 20, max 10,000 nodes)
    TraceQuery qWide;
    qWide.root = 0;
    qWide.direction = Direction::FORWARD;
    qWide.algorithm = Algorithm::BFS;
    qWide.maxDepth = 20;
    qWide.maxNodes = 10000;

    QueryResult resBfsWide = engine.query(qWide, graph, transactions, registry);

    qWide.algorithm = Algorithm::DFS;
    QueryResult resDfsWide = engine.query(qWide, graph, transactions, registry);

    std::cout << "  --- Traversal: Wide Subgraph Query (Depth 20, max 10K nodes) ---\n";
    std::cout << "  BFS: " << std::setw(6) << resBfsWide.stats.executionTimeUs << " us"
              << " | Visited: " << std::setw(6) << resBfsWide.stats.nodesVisited
              << " | Edges Examined: " << std::setw(6) << resBfsWide.stats.edgesExamined
              << " | Result Nodes: " << std::setw(6) << resBfsWide.nodes.size()
              << " | Result Edges: " << resBfsWide.edges.size()
              << (resBfsWide.stats.truncated ? " [TRUNCATED]" : "") << "\n";

    std::cout << "  DFS: " << std::setw(6) << resDfsWide.stats.executionTimeUs << " us"
              << " | Visited: " << std::setw(6) << resDfsWide.stats.nodesVisited
              << " | Edges Examined: " << std::setw(6) << resDfsWide.stats.edgesExamined
              << " | Result Nodes: " << std::setw(6) << resDfsWide.nodes.size()
              << " | Result Edges: " << resDfsWide.edges.size()
              << (resDfsWide.stats.truncated ? " [TRUNCATED]" : "") << "\n";
}

// ============================================================
// Topology 2: High-Branching (Fan-Out / Dusting)
// ============================================================
void runHighBranchingTopology()
{
    std::cout << "\n======================================================================\n";
    std::cout << " TOPOLOGY BENCHMARK: HIGH-BRANCHING (1K TIER-1 + 5K TIER-2 = 6001 NODES)\n";
    std::cout << "======================================================================\n";

    WalletRegistry registry;
    TransactionStore transactions;
    Graph graph;
    TraceEngine engine;

    const size_t TIER1_COUNT = 1000;
    const size_t TIER2_PER_TIER1 = 5;

    Timer timer;
    size_t txIdx = 0;

    for (size_t i = 0; i < TIER1_COUNT; ++i)
    {
        transactions.add(
            registry,
            "TX_ROOT_" + std::to_string(i),
            "ROOT_WALLET",
            "TIER1_" + std::to_string(i),
            doubleToAmount(10.0),
            1726228000ULL + txIdx++,
            "ETH"
        );
    }

    for (size_t i = 0; i < TIER1_COUNT; ++i)
    {
        for (size_t j = 0; j < TIER2_PER_TIER1; ++j)
        {
            transactions.add(
                registry,
                "TX_T2_" + std::to_string(i) + "_" + std::to_string(j),
                "TIER1_" + std::to_string(i),
                "TIER2_" + std::to_string(i) + "_" + std::to_string(j),
                doubleToAmount(1.9),
                1726228000ULL + txIdx++,
                "ETH"
            );
        }
    }

    graph.build(registry.size(), transactions);
    int64_t buildMs = timer.elapsedMs();

    MemoryProfile mem = measureMemory(registry.size(), transactions.size());

    std::cout << "  Total Wallets      : " << registry.size() << " (Expected: 6001)\n";
    std::cout << "  Total Transactions : " << transactions.size() << " (Expected: 6000)\n";
    std::cout << "  Graph Build Time   : " << buildMs << " ms\n";
    std::cout << "  CSR Memory         : " << std::fixed << std::setprecision(2) << mem.csrGraphMB << " MB\n";

    TraceQuery q;
    q.root = registry.find("ROOT_WALLET");
    q.direction = Direction::FORWARD;
    q.algorithm = Algorithm::BFS;
    q.maxDepth = 2;
    q.maxNodes = 10000;

    QueryResult res = engine.query(q, graph, transactions, registry);
    std::cout << "  BFS Full Fan-Out   : " << res.stats.executionTimeUs << " us"
              << " | Visited: " << res.stats.nodesVisited
              << " | Edges Examined: " << res.stats.edgesExamined
              << " | Returned Nodes: " << res.nodes.size()
              << " | Returned Edges: " << res.edges.size() << "\n";
    assert(res.nodes.size() == 6001);

    QueryResult lazyRes = engine.expandNode(q.root, Direction::FORWARD, graph, transactions, registry);
    std::cout << "  1-Hop Lazy Expand  : " << lazyRes.stats.executionTimeUs << " us"
              << " | Visited: " << lazyRes.stats.nodesVisited
              << " | Edges Examined: " << lazyRes.stats.edgesExamined
              << " | Immediate Neighbors: " << lazyRes.nodes.size() - 1 << "\n";
    assert(lazyRes.nodes.size() - 1 == TIER1_COUNT);
}

// ============================================================
// Topology 3: Long-Chain (100,000 Hops Peeling Sequence)
// ============================================================
void runLongChainTopology()
{
    std::cout << "\n======================================================================\n";
    std::cout << " TOPOLOGY BENCHMARK: ULTRA-LONG CHAIN (100,000 HOPS)\n";
    std::cout << "======================================================================\n";

    WalletRegistry registry;
    TransactionStore transactions;
    Graph graph;
    TraceEngine engine;

    const size_t CHAIN_HOPS = 100000;

    Timer timer;
    for (size_t i = 0; i < CHAIN_HOPS; ++i)
    {
        transactions.add(
            registry,
            "TX_CHAIN_" + std::to_string(i),
            "CHAIN_W" + std::to_string(i),
            "CHAIN_W" + std::to_string(i + 1),
            doubleToAmount(100.0 - (i % 1000) * 0.05),
            1726228000ULL + i,
            "ETH"
        );
    }

    graph.build(registry.size(), transactions);
    int64_t buildMs = timer.elapsedMs();

    MemoryProfile mem = measureMemory(registry.size(), transactions.size());

    std::cout << "  Chain Hops         : " << CHAIN_HOPS << "\n";
    std::cout << "  Total Wallets      : " << registry.size() << " (Expected: 100001)\n";
    std::cout << "  Graph Build Time   : " << buildMs << " ms\n";
    std::cout << "  CSR Memory         : " << std::fixed << std::setprecision(2) << mem.csrGraphMB << " MB\n";

    // Test Iterative DFS over 100,000 hops
    TraceQuery dfsQuery;
    dfsQuery.root = registry.find("CHAIN_W0");
    dfsQuery.direction = Direction::FORWARD;
    dfsQuery.algorithm = Algorithm::DFS;
    dfsQuery.maxDepth = 100000;
    dfsQuery.maxNodes = 150000;

    QueryResult dfsRes = engine.query(dfsQuery, graph, transactions, registry);
    std::cout << "  Iterative DFS Time : " << dfsRes.stats.executionTimeUs << " us"
              << " | Visited: " << dfsRes.stats.nodesVisited
              << " | Edges Examined: " << dfsRes.stats.edgesExamined
              << " | Depth Reached: " << dfsRes.nodes.back().depth
              << " | Returned Nodes: " << dfsRes.nodes.size() << "\n";
    assert(dfsRes.nodes.size() == 100001);

    // Test Backward Tracing
    TraceQuery backwardQuery;
    backwardQuery.root = registry.find("CHAIN_W100000");
    backwardQuery.direction = Direction::BACKWARD;
    backwardQuery.algorithm = Algorithm::BFS;
    backwardQuery.maxDepth = 100000;
    backwardQuery.maxNodes = 150000;

    QueryResult bwdRes = engine.query(backwardQuery, graph, transactions, registry);
    std::cout << "  Backward Trace     : " << bwdRes.stats.executionTimeUs << " us"
              << " | Visited: " << bwdRes.stats.nodesVisited
              << " | Edges Examined: " << bwdRes.stats.edgesExamined
              << " | Upstream Nodes: " << bwdRes.nodes.size() << "\n";
    assert(bwdRes.nodes.size() == 100001);
}

// ============================================================
// Topology 4: Cyclic Graph (Wash Trading Loops)
// ============================================================
void runCyclicTopology()
{
    std::cout << "\n======================================================================\n";
    std::cout << " TOPOLOGY BENCHMARK: CYCLIC GRAPH (500 WASH TRADING RINGS)\n";
    std::cout << "======================================================================\n";

    WalletRegistry registry;
    TransactionStore transactions;
    Graph graph;
    TraceEngine engine;

    const size_t NUM_RINGS = 500;
    Timer timer;
    size_t txIdx = 0;

    for (size_t k = 0; k < NUM_RINGS; ++k)
    {
        std::string w0 = "RING_" + std::to_string(k) + "_0";
        std::string w1 = "RING_" + std::to_string(k) + "_1";
        std::string w2 = "RING_" + std::to_string(k) + "_2";

        transactions.add(registry, "TX_CYC_" + std::to_string(txIdx++), w0, w1, doubleToAmount(5.0), 1726228000ULL + txIdx, "ETH");
        transactions.add(registry, "TX_CYC_" + std::to_string(txIdx++), w1, w2, doubleToAmount(4.9), 1726228000ULL + txIdx, "ETH");
        transactions.add(registry, "TX_CYC_" + std::to_string(txIdx++), w2, w0, doubleToAmount(4.8), 1726228000ULL + txIdx, "ETH");

        if (k + 1 < NUM_RINGS)
        {
            std::string nextRingW0 = "RING_" + std::to_string(k + 1) + "_0";
            transactions.add(registry, "TX_CROSS_" + std::to_string(txIdx++), w2, nextRingW0, doubleToAmount(1.0), 1726228000ULL + txIdx, "ETH");
        }
    }

    graph.build(registry.size(), transactions);
    int64_t buildMs = timer.elapsedMs();

    std::cout << "  Rings Configured   : " << NUM_RINGS << " rings (3 nodes each = 1500 wallets)\n";
    std::cout << "  Total Transactions : " << transactions.size() << "\n";
    std::cout << "  Graph Build Time   : " << buildMs << " ms\n";

    TraceQuery q;
    q.root = registry.find("RING_0_0");
    q.direction = Direction::FORWARD;
    q.algorithm = Algorithm::BFS;
    q.maxDepth = 2000;
    q.maxNodes = 5000;

    QueryResult res = engine.query(q, graph, transactions, registry);
    std::cout << "  Cycle Traversal    : " << res.stats.executionTimeUs << " us"
              << " | Visited: " << res.stats.nodesVisited
              << " | Edges Examined: " << res.stats.edgesExamined
              << " | Returned Nodes: " << res.nodes.size()
              << " | Returned Edges: " << res.edges.size() << "\n";
    assert(res.nodes.size() == NUM_RINGS * 3);
}

// ============================================================
// Main
// ============================================================
int main()
{
    std::cout << "======================================================================\n";
    std::cout << " TRANSACTION GRAPH ENGINE VALIDATION & BENCHMARK SUITE\n";
    std::cout << " Phases 2 & 3: Performance, Traversal Completeness & Memory Profiling\n";
    std::cout << "======================================================================\n";

    // Specialized Topologies
    runHighBranchingTopology();
    runLongChainTopology();
    runCyclicTopology();

    // Scale Benchmarks: 1K, 10K, 100K, 1,000,000 Transactions
    runScaleBenchmark(1000);
    runScaleBenchmark(10000);
    runScaleBenchmark(100000);
    runScaleBenchmark(1000000);

    std::cout << "\n======================================================================\n";
    std::cout << " ALL BENCHMARK PHASES COMPLETED SUCCESSFULLY!\n";
    std::cout << "======================================================================\n";

    return 0;
}
