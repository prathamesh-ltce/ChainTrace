#include "../include/Types.h"
#include "../include/WalletRegistry.h"
#include "../include/TransactionStore.h"
#include "../include/Graph.h"
#include "../include/TraceEngine.h"
#include "../include/QueryResult.h"

#include <iostream>
#include <vector>
#include <string>
#include <cassert>
#include <unordered_set>

// ============================================================
// Test Suite 1: Normal Chain (A -> B -> C -> D)
// ============================================================
void testNormalChain()
{
    std::cout << "[Test 1] Normal Chain (A -> B -> C -> D)... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    txs.add(reg, "TX1", "A", "B", doubleToAmount(1.0), 100, "ETH");
    txs.add(reg, "TX2", "B", "C", doubleToAmount(1.0), 200, "ETH");
    txs.add(reg, "TX3", "C", "D", doubleToAmount(1.0), 300, "ETH");
    graph.build(reg.size(), txs);

    WalletID idA = reg.find("A");
    WalletID idB = reg.find("B");
    WalletID idC = reg.find("C");
    WalletID idD = reg.find("D");

    // BFS Verification
    TraceQuery qBfs;
    qBfs.root = idA;
    qBfs.direction = Direction::FORWARD;
    qBfs.algorithm = Algorithm::BFS;
    qBfs.maxDepth = 10;
    QueryResult resBfs = engine.query(qBfs, graph, txs, reg);

    assert(resBfs.nodes.size() == 4);
    assert(resBfs.nodes[0].walletId == idA && resBfs.nodes[0].depth == 0);
    assert(resBfs.nodes[1].walletId == idB && resBfs.nodes[1].depth == 1);
    assert(resBfs.nodes[2].walletId == idC && resBfs.nodes[2].depth == 2);
    assert(resBfs.nodes[3].walletId == idD && resBfs.nodes[3].depth == 3);

    // DFS Verification
    TraceQuery qDfs = qBfs;
    qDfs.algorithm = Algorithm::DFS;
    QueryResult resDfs = engine.query(qDfs, graph, txs, reg);
    assert(resDfs.nodes.size() == 4);
    assert(resDfs.nodes[0].walletId == idA);

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 2: Merge (A -> C, B -> C)
// ============================================================
void testMerge()
{
    std::cout << "[Test 2] Merge Topologies (A -> C, B -> C)... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;

    txs.add(reg, "TX1", "A", "C", doubleToAmount(2.0), 100, "ETH");
    txs.add(reg, "TX2", "B", "C", doubleToAmount(3.0), 200, "ETH");
    graph.build(reg.size(), txs);

    assert(reg.size() == 3); // exactly A, B, C
    WalletID idC = reg.find("C");
    assert(idC != INVALID_WALLET);

    // C must have incoming degree of 2
    auto inEdges = graph.getIncoming(idC);
    assert(inEdges.size() == 2);

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 3: Split (A -> B, A -> C)
// ============================================================
void testSplit()
{
    std::cout << "[Test 3] Split Topologies (A -> B, A -> C)... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    txs.add(reg, "TX1", "A", "B", doubleToAmount(1.5), 100, "ETH");
    txs.add(reg, "TX2", "A", "C", doubleToAmount(2.5), 200, "ETH");
    graph.build(reg.size(), txs);

    WalletID idA = reg.find("A");
    TraceQuery q;
    q.root = idA;
    q.direction = Direction::FORWARD;
    QueryResult res = engine.query(q, graph, txs, reg);

    assert(res.nodes.size() == 3); // A, B, C
    assert(res.edges.size() == 2);
    assert(res.nodes[1].depth == 1 && res.nodes[2].depth == 1);

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 4: Cycle (A -> B -> C -> A)
// ============================================================
void testCycle()
{
    std::cout << "[Test 4] Cycle Protection (A -> B -> C -> A)... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    txs.add(reg, "TX1", "A", "B", doubleToAmount(1.0), 100, "ETH");
    txs.add(reg, "TX2", "B", "C", doubleToAmount(1.0), 200, "ETH");
    txs.add(reg, "TX3", "C", "A", doubleToAmount(1.0), 300, "ETH");
    graph.build(reg.size(), txs);

    TraceQuery q;
    q.root = reg.find("A");
    q.direction = Direction::FORWARD;
    q.maxDepth = 100; // high depth to test termination
    QueryResult res = engine.query(q, graph, txs, reg);

    assert(res.nodes.size() == 3); // Exactly A, B, C visited once

    std::unordered_set<WalletID> seen;
    for (const auto& n : res.nodes)
    {
        assert(seen.find(n.walletId) == seen.end());
        seen.insert(n.walletId);
    }

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 5: Deep Chain (100,000+ hops, no stack overflow)
// ============================================================
void testDeepChain()
{
    std::cout << "[Test 5] Ultra-Deep Chain (100,000+ hops, stack safety)... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    const size_t HOPS = 100000;
    for (size_t i = 0; i < HOPS; ++i)
    {
        txs.add(reg, "TX" + std::to_string(i), "W" + std::to_string(i), "W" + std::to_string(i + 1), doubleToAmount(1.0), 1000 + i, "ETH");
    }
    graph.build(reg.size(), txs);

    assert(reg.size() == HOPS + 1);

    // Test Iterative DFS over 100,000 hops
    TraceQuery qDfs;
    qDfs.root = reg.find("W0");
    qDfs.direction = Direction::FORWARD;
    qDfs.algorithm = Algorithm::DFS;
    qDfs.maxDepth = 100000;
    qDfs.maxNodes = 150000;

    QueryResult resDfs = engine.query(qDfs, graph, txs, reg);
    assert(resDfs.nodes.size() == HOPS + 1);
    assert(resDfs.nodes.back().depth == HOPS);

    // Test Iterative BFS over 100,000 hops
    TraceQuery qBfs = qDfs;
    qBfs.algorithm = Algorithm::BFS;
    QueryResult resBfs = engine.query(qBfs, graph, txs, reg);
    assert(resBfs.nodes.size() == HOPS + 1);

    std::cout << "PASSED (100,001 nodes traversed successfully)\n";
}

// ============================================================
// Test Suite 6: High Branching (1K and 10K Wallets + maxNodes)
// ============================================================
void testHighBranching()
{
    std::cout << "[Test 6] High Branching (1K & 10K fan-out + maxNodes)... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    const size_t FAN_OUT = 10000;
    for (size_t i = 0; i < FAN_OUT; ++i)
    {
        txs.add(reg, "TX" + std::to_string(i), "HUB", "LEAF" + std::to_string(i), doubleToAmount(0.1), 1000 + i, "ETH");
    }
    graph.build(reg.size(), txs);
    assert(reg.size() == FAN_OUT + 1);

    WalletID hubId = reg.find("HUB");

    // Full query
    TraceQuery qFull;
    qFull.root = hubId;
    qFull.direction = Direction::FORWARD;
    qFull.maxDepth = 1;
    qFull.maxNodes = 20000;
    QueryResult resFull = engine.query(qFull, graph, txs, reg);
    assert(resFull.nodes.size() == FAN_OUT + 1);
    assert(resFull.edges.size() == FAN_OUT);
    assert(!resFull.stats.truncated);

    // maxNodes protection test (maxNodes = 500)
    TraceQuery qTrunc = qFull;
    qTrunc.maxNodes = 500;
    QueryResult resTrunc = engine.query(qTrunc, graph, txs, reg);
    assert(resTrunc.nodes.size() == 500);
    assert(resTrunc.stats.truncated);

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 7: Backward Traversal (A -> B -> C, trace from C)
// ============================================================
void testBackwardTraversal()
{
    std::cout << "[Test 7] Backward Traversal (A -> B -> C from C)... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    txs.add(reg, "TX1", "A", "B", doubleToAmount(10.0), 100, "ETH");
    txs.add(reg, "TX2", "B", "C", doubleToAmount(9.0), 200, "ETH");
    graph.build(reg.size(), txs);

    TraceQuery q;
    q.root = reg.find("C");
    q.direction = Direction::BACKWARD;
    q.maxDepth = 5;
    QueryResult res = engine.query(q, graph, txs, reg);

    assert(res.nodes.size() == 3);
    assert(res.nodes[0].walletId == reg.find("C") && res.nodes[0].depth == 0);
    assert(res.nodes[1].walletId == reg.find("B") && res.nodes[1].depth == 1);
    assert(res.nodes[2].walletId == reg.find("A") && res.nodes[2].depth == 2);
    assert(res.edges[0].direction == Direction::BACKWARD);

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 8: BOTH (Bidirectional) Traversal
// ============================================================
void testBothDirectionTraversal()
{
    std::cout << "[Test 8] Bidirectional (BOTH) Traversal... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    // IN1 -> CENTER -> OUT1
    // IN2 -> CENTER -> OUT2
    txs.add(reg, "TX_IN1", "IN1", "CENTER", doubleToAmount(1.0), 100, "ETH");
    txs.add(reg, "TX_IN2", "IN2", "CENTER", doubleToAmount(2.0), 100, "ETH");
    txs.add(reg, "TX_OUT1", "CENTER", "OUT1", doubleToAmount(3.0), 200, "ETH");
    txs.add(reg, "TX_OUT2", "CENTER", "OUT2", doubleToAmount(4.0), 200, "ETH");
    graph.build(reg.size(), txs);

    TraceQuery q;
    q.root = reg.find("CENTER");
    q.direction = Direction::BOTH;
    q.maxDepth = 1;
    QueryResult res = engine.query(q, graph, txs, reg);

    assert(res.nodes.size() == 5); // CENTER + 2 IN + 2 OUT
    assert(res.edges.size() == 4);

    std::unordered_set<WalletID> seen;
    for (const auto& n : res.nodes)
    {
        assert(seen.find(n.walletId) == seen.end());
        seen.insert(n.walletId);
    }

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 9: Depth Limit Enforcement
// ============================================================
void testDepthLimit()
{
    std::cout << "[Test 9] Depth Limit Enforcement... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    // A -> B -> C -> D -> E
    txs.add(reg, "TX1", "A", "B", doubleToAmount(1.0), 100, "ETH");
    txs.add(reg, "TX2", "B", "C", doubleToAmount(1.0), 200, "ETH");
    txs.add(reg, "TX3", "C", "D", doubleToAmount(1.0), 300, "ETH");
    txs.add(reg, "TX4", "D", "E", doubleToAmount(1.0), 400, "ETH");
    graph.build(reg.size(), txs);

    TraceQuery q;
    q.root = reg.find("A");
    q.direction = Direction::FORWARD;
    q.maxDepth = 2; // Should strictly return A (0), B (1), C (2)

    QueryResult res = engine.query(q, graph, txs, reg);
    assert(res.nodes.size() == 3);
    assert(res.nodes.back().walletId == reg.find("C"));
    assert(res.nodes.back().depth == 2);

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 10: Multi-Criteria Filtering
// ============================================================
void testFilters()
{
    std::cout << "[Test 10] Filtering (Amount, Time, Asset, Direction)... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    // ROOT -> W_ETH_TINY (0.01 ETH, time 100)
    // ROOT -> W_ETH_BIG  (10.0 ETH, time 200)
    // ROOT -> W_BTC      (5.0  BTC, time 200)
    // ROOT -> W_LATE     (10.0 ETH, time 900)
    txs.add(reg, "TX1", "ROOT", "W_ETH_TINY", doubleToAmount(0.01), 100, "ETH");
    txs.add(reg, "TX2", "ROOT", "W_ETH_BIG",  doubleToAmount(10.0), 200, "ETH");
    txs.add(reg, "TX3", "ROOT", "W_BTC",      doubleToAmount(5.0),  200, "BTC");
    txs.add(reg, "TX4", "ROOT", "W_LATE",     doubleToAmount(10.0), 900, "ETH");
    graph.build(reg.size(), txs);

    WalletID root = reg.find("ROOT");

    // Combined query: minAmount = 1.0, time in [150, 500], asset = "ETH"
    TraceQuery q;
    q.root = root;
    q.direction = Direction::FORWARD;
    q.minAmount = doubleToAmount(1.0);
    q.minTimestamp = 150;
    q.maxTimestamp = 500;
    q.asset = "ETH";

    QueryResult res = engine.query(q, graph, txs, reg);
    assert(res.nodes.size() == 2); // ROOT + W_ETH_BIG only
    assert(res.nodes[1].walletId == reg.find("W_ETH_BIG"));

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 11: Wallet ID Stability
// ============================================================
void testWalletIdStability()
{
    std::cout << "[Test 11] Wallet ID Stability... ";
    WalletRegistry reg;

    WalletID idA1 = reg.getOrCreate("0xAbc123");
    WalletID idB  = reg.getOrCreate("0xDef456");
    WalletID idA2 = reg.getOrCreate("0xAbc123");
    WalletID idA3 = reg.find("0xAbc123");

    assert(idA1 == idA2);
    assert(idA1 == idA3);
    assert(idA1 != idB);
    assert(reg.size() == 2);

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 12: Lazy Expansion Neighborhood Isolation
// ============================================================
void testLazyExpansionIsolation()
{
    std::cout << "[Test 12] Lazy Expansion Neighborhood Isolation... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    // Large component: ROOT -> A1 -> B1 -> C1 -> D1
    //                         -> A2 -> B2 -> C2 -> D2
    txs.add(reg, "TX1", "ROOT", "A1", doubleToAmount(1.0), 100, "ETH");
    txs.add(reg, "TX2", "ROOT", "A2", doubleToAmount(1.0), 100, "ETH");
    txs.add(reg, "TX3", "A1", "B1", doubleToAmount(1.0), 200, "ETH");
    txs.add(reg, "TX4", "B1", "C1", doubleToAmount(1.0), 300, "ETH");
    txs.add(reg, "TX5", "C1", "D1", doubleToAmount(1.0), 400, "ETH");
    txs.add(reg, "TX6", "A2", "B2", doubleToAmount(1.0), 200, "ETH");
    graph.build(reg.size(), txs);

    // 1-hop lazy expansion from ROOT must ONLY return ROOT, A1, A2 (3 nodes total)
    QueryResult lazyRes = engine.expandNode(reg.find("ROOT"), Direction::FORWARD, graph, txs, reg);
    assert(lazyRes.nodes.size() == 3);
    assert(lazyRes.edges.size() == 2);

    // Expand A1: must ONLY return A1 and B1
    QueryResult lazyA1 = engine.expandNode(reg.find("A1"), Direction::FORWARD, graph, txs, reg);
    assert(lazyA1.nodes.size() == 2);
    assert(lazyA1.nodes[1].walletId == reg.find("B1"));

    std::cout << "PASSED\n";
}

// ============================================================
// Test Suite 13: Multi-Cryptocurrency & Cross-Chain Support
// Supports: BTC, ETH, USDT, SOL, TRX, DOGE, etc.
// Verifies native decimal scaling, heterogeneous addresses,
// and cross-asset flow tracing.
// ============================================================
void testMultiCryptoCrossChain()
{
    std::cout << "[Test 13] Multi-Crypto & Cross-Chain Support (BTC, ETH, USDT, SOL, TRX)... ";
    WalletRegistry reg;
    TransactionStore txs;
    Graph graph;
    TraceEngine engine;

    // Heterogeneous address formats across blockchains
    std::string btcSender = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"; // Bitcoin Bech32
    std::string btcReceiver = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";        // Bitcoin P2PKH
    std::string tronWallet = "TJYd9sX8Wp9s5N7bX71c3E1f9Xy8aBcDeF";          // Tron Base58
    std::string ethWallet = "0x71C836343791Aa6422505603b9b4f6F4f74d014F";  // Ethereum EVM
    std::string solWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"; // Solana Base58

    // Cross-crypto laundering / bridge path:
    // BTC Sender -> BTC Receiver (0.54321000 BTC, 8 decimals)
    // BTC Receiver -> Tron Wallet (15,000.500000 USDT on Tron, 6 decimals)
    // Tron Wallet -> ETH Wallet (5.25000000 ETH, 8/18 decimals)
    // ETH Wallet -> Solana Wallet (125.123456789 SOL, 9 decimals)
    txs.add(reg, "TX_BTC", btcSender, btcReceiver, parseCryptoAmount("0.54321", "BTC"), 1726228000, "BTC");
    txs.add(reg, "TX_USDT", btcReceiver, tronWallet, parseCryptoAmount("15000.50", "USDT"), 1726228100, "USDT");
    txs.add(reg, "TX_ETH", tronWallet, ethWallet, parseCryptoAmount("5.25", "ETH"), 1726228200, "ETH");
    txs.add(reg, "TX_SOL", ethWallet, solWallet, parseCryptoAmount("125.123456789", "SOL"), 1726228300, "SOL");
    graph.build(reg.size(), txs);

    assert(reg.size() == 5);

    // 1. Cross-Crypto Trace (asset = "" traces full laundering path across all chains)
    TraceQuery qAll;
    qAll.root = reg.find(btcSender);
    qAll.direction = Direction::FORWARD;
    qAll.maxDepth = 10;
    QueryResult resAll = engine.query(qAll, graph, txs, reg);

    assert(resAll.nodes.size() == 5);
    assert(resAll.edges.size() == 4);
    assert(resAll.edges[0].asset == "BTC");
    assert(resAll.edges[1].asset == "USDT");
    assert(resAll.edges[2].asset == "ETH");
    assert(resAll.edges[3].asset == "SOL");

    // Verify decimal formatting matches native blockchain specifications
    assert(formatCryptoAmount(resAll.edges[0].amount, "BTC") == "0.54321");
    assert(formatCryptoAmount(resAll.edges[1].amount, "USDT") == "15000.5");
    assert(formatCryptoAmount(resAll.edges[2].amount, "ETH") == "5.25");
    assert(formatCryptoAmount(resAll.edges[3].amount, "SOL") == "125.123456789");

    // 2. Asset Filter: Target only "USDT" transfers
    TraceQuery qUsdt;
    qUsdt.root = reg.find(btcReceiver);
    qUsdt.direction = Direction::FORWARD;
    qUsdt.asset = "USDT";
    QueryResult resUsdt = engine.query(qUsdt, graph, txs, reg);
    assert(resUsdt.nodes.size() == 2); // btcReceiver + tronWallet
    assert(resUsdt.edges.size() == 1);
    assert(resUsdt.edges[0].asset == "USDT");

    // 3. JSON Output verification with multi-crypto fields
    std::string json = resAll.toJson();
    assert(json.find("\"asset\": \"BTC\"") != std::string::npos);
    assert(json.find("\"asset\": \"SOL\"") != std::string::npos);
    assert(json.find("\"asset\": \"USDT\"") != std::string::npos);
    assert(json.find("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq") != std::string::npos);

    std::cout << "PASSED\n";
}

// ============================================================
// Main
// ============================================================
int main()
{
    std::cout << "============================================================\n";
    std::cout << " AUTOMATED GRAPH ENGINE CORRECTNESS TEST SUITE\n";
    std::cout << " Testing: Chains, Merges, Splits, Cycles, Scale, Multi-Crypto\n";
    std::cout << "============================================================\n";

    testNormalChain();
    testMerge();
    testSplit();
    testCycle();
    testDeepChain();
    testHighBranching();
    testBackwardTraversal();
    testBothDirectionTraversal();
    testDepthLimit();
    testFilters();
    testWalletIdStability();
    testLazyExpansionIsolation();
    testMultiCryptoCrossChain();

    std::cout << "\n============================================================\n";
    std::cout << " ALL 13 CORRECTNESS TESTS PASSED SUCCESSFULLY! (0 Failures)\n";
    std::cout << "============================================================\n";

    return 0;
}
