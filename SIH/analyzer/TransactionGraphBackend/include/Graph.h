#pragma once

#include "Types.h"
#include "TransactionStore.h"

#include <cstddef>
#include <vector>

// --------------------------------------------------------
// Lightweight view for iterating over edges.
// --------------------------------------------------------
struct EdgeView
{
    const TransactionID* start;
    const TransactionID* finish;

    const TransactionID* begin() const { return start; }
    const TransactionID* end() const { return finish; }
    size_t size() const { return finish - start; }
};

class Graph
{
private:

    // --------------------------------------------------------
    // CSR arrays for outgoing edges
    // --------------------------------------------------------
    std::vector<size_t> outOffsets;
    std::vector<TransactionID> outEdges;

    // --------------------------------------------------------
    // CSR arrays for incoming edges
    // --------------------------------------------------------
    std::vector<size_t> inOffsets;
    std::vector<TransactionID> inEdges;

    size_t numWallets;

public:
    Graph();

    // --------------------------------------------------------
    // Build the graph using CSR format.
    // Extremely fast and memory efficient.
    // --------------------------------------------------------
    void build(
        size_t walletCount,
        const TransactionStore& store);

    // --------------------------------------------------------
    // Get outgoing transactions.
    // --------------------------------------------------------
    EdgeView getOutgoing(
        WalletID wallet) const;

    // --------------------------------------------------------
    // Get incoming transactions.
    // --------------------------------------------------------
    EdgeView getIncoming(
        WalletID wallet) const;

    // --------------------------------------------------------
    // Number of wallets indexed.
    // --------------------------------------------------------
    size_t walletCount() const;
};