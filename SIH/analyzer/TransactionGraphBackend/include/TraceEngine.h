#pragma once

#include "Types.h"
#include "Graph.h"
#include "TransactionStore.h"
#include "WalletRegistry.h"
#include "QueryResult.h"

#include <cstddef>
#include <vector>

// ============================================================
// TraceQuery
// Multi-criteria investigation query parameters.
// ============================================================

struct TraceQuery
{
    WalletID root = INVALID_WALLET;
    Direction direction = Direction::FORWARD;
    Algorithm algorithm = Algorithm::BFS;
    uint32_t maxDepth = 5;
    size_t maxNodes = 1000;
    Amount minAmount = 0;
    uint64_t minTimestamp = 0;
    uint64_t maxTimestamp = UINT64_MAX;
    std::string asset = ""; // empty = match all
};

// ============================================================
// TraceEngine
// Production-grade graph traversal & investigation engine.
// ============================================================

class TraceEngine
{
private:
    // Search stamp visited tracking: O(1) reset across queries
    std::vector<uint32_t> visitStamp;
    uint32_t currentSearch;

    void ensureCapacity(size_t walletCount);

    QueryResult runBFS(
        const TraceQuery& q,
        const Graph& graph,
        const TransactionStore& transactions,
        const WalletRegistry& registry);

    QueryResult runDFS(
        const TraceQuery& q,
        const Graph& graph,
        const TransactionStore& transactions,
        const WalletRegistry& registry);

public:
    TraceEngine();

    // Primary structured query method returning decoupled QueryResult
    QueryResult query(
        const TraceQuery& queryParams,
        const Graph& graph,
        const TransactionStore& transactions,
        const WalletRegistry& registry);

    // 1-Hop Lazy Subgraph Expansion for large graph UI drill-down
    QueryResult expandNode(
        WalletID wallet,
        Direction direction,
        const Graph& graph,
        const TransactionStore& transactions,
        const WalletRegistry& registry,
        Amount minAmount = 0,
        uint64_t minTimestamp = 0,
        uint64_t maxTimestamp = UINT64_MAX,
        const std::string& asset = "");

    // Backward compatibility trace method
    std::vector<TraceNode> trace(
        WalletID source,
        const Graph& graph,
        const TransactionStore& transactions,
        int maxDepth,
        size_t maxNodes);
};