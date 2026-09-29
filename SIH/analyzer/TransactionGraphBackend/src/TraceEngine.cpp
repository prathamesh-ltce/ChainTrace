#include "../include/TraceEngine.h"

#include <queue>
#include <chrono>
#include <algorithm>

namespace {

struct TraversalItem
{
    WalletID wallet;
    uint32_t depth;
};

inline bool matchEdge(
    const Transaction& tx,
    Amount minAmount,
    uint64_t minTimestamp,
    uint64_t maxTimestamp,
    const std::string& asset)
{
    if (tx.amount < minAmount) return false;
    if (tx.timestamp < minTimestamp || tx.timestamp > maxTimestamp) return false;
    if (!asset.empty() && tx.asset != asset) return false;
    return true;
}

} // namespace

// ============================================================
// Constructor
// ============================================================

TraceEngine::TraceEngine()
    : currentSearch(0)
{
}

// ============================================================
// Ensure visit array size
// ============================================================

void TraceEngine::ensureCapacity(size_t walletCount)
{
    if (visitStamp.size() < walletCount)
    {
        visitStamp.resize(walletCount, 0);
    }
}

// ============================================================
// Query entry point
// ============================================================

QueryResult TraceEngine::query(
    const TraceQuery& q,
    const Graph& graph,
    const TransactionStore& transactions,
    const WalletRegistry& registry)
{
    auto startTime = std::chrono::steady_clock::now();

    QueryResult result;
    if (q.root >= graph.walletCount() || q.maxNodes == 0)
    {
        return result;
    }

    if (q.algorithm == Algorithm::DFS)
    {
        result = runDFS(q, graph, transactions, registry);
    }
    else
    {
        result = runBFS(q, graph, transactions, registry);
    }

    auto endTime = std::chrono::steady_clock::now();
    result.stats.executionTimeUs = std::chrono::duration_cast<std::chrono::microseconds>(
        endTime - startTime).count();
    result.stats.nodesCount = result.nodes.size();
    result.stats.edgesCount = result.edges.size();

    return result;
}

// ============================================================
// Iterative BFS Traversal
// ============================================================

QueryResult TraceEngine::runBFS(
    const TraceQuery& q,
    const Graph& graph,
    const TransactionStore& transactions,
    const WalletRegistry& registry)
{
    QueryResult result;

    ensureCapacity(graph.walletCount());

    ++currentSearch;
    if (currentSearch == 0)
    {
        std::fill(visitStamp.begin(), visitStamp.end(), 0);
        currentSearch = 1;
    }

    std::queue<TraversalItem> queue;

    visitStamp[q.root] = currentSearch;

    const Wallet& rootWallet = registry.get(q.root);
    result.sourceWalletId = q.root;
    result.sourceAddress = rootWallet.address;

    result.nodes.push_back({
        q.root,
        rootWallet.address,
        rootWallet.label,
        rootWallet.type,
        0,
        INVALID_WALLET
    });

    queue.push({q.root, 0});

    while (!queue.empty())
    {
        TraversalItem current = queue.front();
        queue.pop();
        result.stats.nodesVisited++;

        if (current.depth >= q.maxDepth)
        {
            continue;
        }

        uint32_t nextDepth = current.depth + 1;

        // 1. Outgoing fund flows (FORWARD or BOTH)
        if (q.direction == Direction::FORWARD || q.direction == Direction::BOTH)
        {
            const auto& edges = graph.getOutgoing(current.wallet);
            for (TransactionID txID : edges)
            {
                result.stats.edgesExamined++;
                const Transaction& tx = transactions.get(txID);
                if (!matchEdge(tx, q.minAmount, q.minTimestamp, q.maxTimestamp, q.asset))
                {
                    continue;
                }

                WalletID next = tx.to;
                if (visitStamp[next] == currentSearch)
                {
                    continue;
                }

                visitStamp[next] = currentSearch;

                const Wallet& w = registry.get(next);
                result.nodes.push_back({
                    next,
                    w.address,
                    w.label,
                    w.type,
                    nextDepth,
                    current.wallet
                });

                result.edges.push_back({
                    txID,
                    tx.from,
                    tx.to,
                    tx.amount,
                    tx.timestamp,
                    tx.asset,
                    Direction::FORWARD
                });

                if (result.nodes.size() >= q.maxNodes)
                {
                    result.stats.truncated = true;
                    return result;
                }

                queue.push({next, nextDepth});
            }
        }

        // 2. Incoming origin traces (BACKWARD or BOTH)
        if (q.direction == Direction::BACKWARD || q.direction == Direction::BOTH)
        {
            const auto& edges = graph.getIncoming(current.wallet);
            for (TransactionID txID : edges)
            {
                result.stats.edgesExamined++;
                const Transaction& tx = transactions.get(txID);
                if (!matchEdge(tx, q.minAmount, q.minTimestamp, q.maxTimestamp, q.asset))
                {
                    continue;
                }

                WalletID next = tx.from;
                if (visitStamp[next] == currentSearch)
                {
                    continue;
                }

                visitStamp[next] = currentSearch;

                const Wallet& w = registry.get(next);
                result.nodes.push_back({
                    next,
                    w.address,
                    w.label,
                    w.type,
                    nextDepth,
                    current.wallet
                });

                result.edges.push_back({
                    txID,
                    tx.from,
                    tx.to,
                    tx.amount,
                    tx.timestamp,
                    tx.asset,
                    Direction::BACKWARD
                });

                if (result.nodes.size() >= q.maxNodes)
                {
                    result.stats.truncated = true;
                    return result;
                }

                queue.push({next, nextDepth});
            }
        }
    }

    return result;
}

// ============================================================
// Iterative DFS Traversal (explicit stack, stack-safe for 10K+ hops)
// ============================================================

QueryResult TraceEngine::runDFS(
    const TraceQuery& q,
    const Graph& graph,
    const TransactionStore& transactions,
    const WalletRegistry& registry)
{
    QueryResult result;

    ensureCapacity(graph.walletCount());

    ++currentSearch;
    if (currentSearch == 0)
    {
        std::fill(visitStamp.begin(), visitStamp.end(), 0);
        currentSearch = 1;
    }

    std::vector<TraversalItem> stack;

    visitStamp[q.root] = currentSearch;

    const Wallet& rootWallet = registry.get(q.root);
    result.sourceWalletId = q.root;
    result.sourceAddress = rootWallet.address;

    result.nodes.push_back({
        q.root,
        rootWallet.address,
        rootWallet.label,
        rootWallet.type,
        0,
        INVALID_WALLET
    });

    stack.push_back({q.root, 0});

    while (!stack.empty())
    {
        TraversalItem current = stack.back();
        stack.pop_back();
        result.stats.nodesVisited++;

        if (current.depth >= q.maxDepth)
        {
            continue;
        }

        uint32_t nextDepth = current.depth + 1;

        // 1. Outgoing fund flows (FORWARD or BOTH)
        if (q.direction == Direction::FORWARD || q.direction == Direction::BOTH)
        {
            const auto& edges = graph.getOutgoing(current.wallet);
            for (TransactionID txID : edges)
            {
                result.stats.edgesExamined++;
                const Transaction& tx = transactions.get(txID);
                if (!matchEdge(tx, q.minAmount, q.minTimestamp, q.maxTimestamp, q.asset))
                {
                    continue;
                }

                WalletID next = tx.to;
                if (visitStamp[next] == currentSearch)
                {
                    continue;
                }

                visitStamp[next] = currentSearch;

                const Wallet& w = registry.get(next);
                result.nodes.push_back({
                    next,
                    w.address,
                    w.label,
                    w.type,
                    nextDepth,
                    current.wallet
                });

                result.edges.push_back({
                    txID,
                    tx.from,
                    tx.to,
                    tx.amount,
                    tx.timestamp,
                    tx.asset,
                    Direction::FORWARD
                });

                if (result.nodes.size() >= q.maxNodes)
                {
                    result.stats.truncated = true;
                    return result;
                }

                stack.push_back({next, nextDepth});
            }
        }

        // 2. Incoming origin traces (BACKWARD or BOTH)
        if (q.direction == Direction::BACKWARD || q.direction == Direction::BOTH)
        {
            const auto& edges = graph.getIncoming(current.wallet);
            for (TransactionID txID : edges)
            {
                result.stats.edgesExamined++;
                const Transaction& tx = transactions.get(txID);
                if (!matchEdge(tx, q.minAmount, q.minTimestamp, q.maxTimestamp, q.asset))
                {
                    continue;
                }

                WalletID next = tx.from;
                if (visitStamp[next] == currentSearch)
                {
                    continue;
                }

                visitStamp[next] = currentSearch;

                const Wallet& w = registry.get(next);
                result.nodes.push_back({
                    next,
                    w.address,
                    w.label,
                    w.type,
                    nextDepth,
                    current.wallet
                });

                result.edges.push_back({
                    txID,
                    tx.from,
                    tx.to,
                    tx.amount,
                    tx.timestamp,
                    tx.asset,
                    Direction::BACKWARD
                });

                if (result.nodes.size() >= q.maxNodes)
                {
                    result.stats.truncated = true;
                    return result;
                }

                stack.push_back({next, nextDepth});
            }
        }
    }

    return result;
}

// ============================================================
// 1-Hop Lazy Expansion for UI Drill-Down
// ============================================================

QueryResult TraceEngine::expandNode(
    WalletID wallet,
    Direction direction,
    const Graph& graph,
    const TransactionStore& transactions,
    const WalletRegistry& registry,
    Amount minAmount,
    uint64_t minTimestamp,
    uint64_t maxTimestamp,
    const std::string& asset)
{
    TraceQuery q;
    q.root = wallet;
    q.direction = direction;
    q.algorithm = Algorithm::BFS;
    q.maxDepth = 1;      // Exactly 1 hop
    q.maxNodes = 5000;   // High enough for local neighborhood
    q.minAmount = minAmount;
    q.minTimestamp = minTimestamp;
    q.maxTimestamp = maxTimestamp;
    q.asset = asset;

    return query(q, graph, transactions, registry);
}

// ============================================================
// Backward Compatibility trace()
// ============================================================

std::vector<TraceNode> TraceEngine::trace(
    WalletID source,
    const Graph& graph,
    const TransactionStore& transactions,
    int maxDepth,
    size_t maxNodes)
{
    std::vector<TraceNode> legacyResult;

    TraceQuery q;
    q.root = source;
    q.direction = Direction::FORWARD;
    q.algorithm = Algorithm::BFS;
    q.maxDepth = static_cast<uint16_t>(maxDepth < 0 ? 0 : maxDepth);
    q.maxNodes = maxNodes;

    ensureCapacity(graph.walletCount());

    ++currentSearch;
    if (currentSearch == 0)
    {
        std::fill(visitStamp.begin(), visitStamp.end(), 0);
        currentSearch = 1;
    }

    if (source >= graph.walletCount() || maxNodes == 0)
    {
        return legacyResult;
    }

    std::queue<TraversalItem> queue;
    visitStamp[source] = currentSearch;

    legacyResult.push_back({
        source,
        INVALID_TRANSACTION,
        INVALID_WALLET,
        0
    });

    queue.push({source, 0});

    while (!queue.empty())
    {
        TraversalItem current = queue.front();
        queue.pop();

        if (current.depth >= q.maxDepth)
        {
            continue;
        }

        uint32_t nextDepth = current.depth + 1;
        const auto& edges = graph.getOutgoing(current.wallet);

        for (TransactionID txID : edges)
        {
            const Transaction& tx = transactions.get(txID);
            WalletID next = tx.to;

            if (visitStamp[next] == currentSearch)
            {
                continue;
            }

            visitStamp[next] = currentSearch;

            legacyResult.push_back({
                next,
                txID,
                current.wallet,
                nextDepth
            });

            if (legacyResult.size() >= maxNodes)
            {
                return legacyResult;
            }

            queue.push({next, nextDepth});
        }
    }

    return legacyResult;
}
