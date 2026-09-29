#pragma once

#include "Types.h"
#include <string>
#include <vector>

// ============================================================
// Query Subgraph Node
// ============================================================

struct QueryNode
{
    WalletID walletId;
    std::string address;
    std::string label;
    WalletType type;
    uint32_t depth;
    WalletID parentWallet;
};

// ============================================================
// Query Subgraph Edge
// ============================================================

struct QueryEdge
{
    TransactionID txId;
    WalletID from;
    WalletID to;
    Amount amount;
    uint64_t timestamp;
    std::string asset;
    Direction direction;
};

// ============================================================
// Query Performance & Result Statistics
// ============================================================

struct QueryStats
{
    size_t nodesCount = 0;       // Number of nodes returned in result
    size_t edgesCount = 0;       // Number of edges returned in result
    size_t nodesVisited = 0;     // Total nodes popped and processed in traversal
    size_t edgesExamined = 0;    // Total incident edges inspected across visited nodes
    uint64_t executionTimeUs = 0; // Traversal duration in microseconds
    bool truncated = false;      // True if maxNodes boundary was triggered
};

// ============================================================
// Query Result DTO
// Decouples frontend/API layer from CSR graph internals.
// ============================================================

class QueryResult
{
public:
    WalletID sourceWalletId = INVALID_WALLET;
    std::string sourceAddress = "";

    std::vector<QueryNode> nodes;
    std::vector<QueryEdge> edges;
    QueryStats stats;

    // Convert to JSON string for API consumers and UI renderers
    std::string toJson() const;

    // Print summary to stdout
    void printSummary() const;
};
