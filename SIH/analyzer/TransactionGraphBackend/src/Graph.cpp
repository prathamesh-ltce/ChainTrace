#include "../include/Graph.h"
#include <stdexcept>

Graph::Graph() : numWallets(0)
{
}

// ============================================================
// Build CSR Graph
// ============================================================
void Graph::build(
    size_t walletCount,
    const TransactionStore& store)
{
    numWallets = walletCount;

    size_t txCount = store.size();

    // 1. Count degrees
    std::vector<size_t> outDegrees(walletCount, 0);
    std::vector<size_t> inDegrees(walletCount, 0);

    for (size_t i = 0; i < txCount; ++i)
    {
        const Transaction& tx = store.get(static_cast<TransactionID>(i));
        outDegrees[tx.from]++;
        inDegrees[tx.to]++;
    }

    // 2. Compute prefix sums (offsets)
    outOffsets.resize(walletCount + 1, 0);
    inOffsets.resize(walletCount + 1, 0);

    for (size_t i = 0; i < walletCount; ++i)
    {
        outOffsets[i + 1] = outOffsets[i] + outDegrees[i];
        inOffsets[i + 1] = inOffsets[i] + inDegrees[i];
    }

    // Allocate edge arrays exactly once
    outEdges.resize(txCount);
    inEdges.resize(txCount);

    // 3. Insert edges using offsets as current insertion index
    std::vector<size_t> currentOut = outOffsets;
    std::vector<size_t> currentIn = inOffsets;

    for (size_t i = 0; i < txCount; ++i)
    {
        TransactionID txID = static_cast<TransactionID>(i);
        const Transaction& tx = store.get(txID);

        outEdges[currentOut[tx.from]++] = txID;
        inEdges[currentIn[tx.to]++] = txID;
    }
}

// ============================================================
// Outgoing
// ============================================================
EdgeView Graph::getOutgoing(WalletID wallet) const
{
    if (wallet >= numWallets)
    {
        throw std::out_of_range("Invalid wallet");
    }

    const TransactionID* start = outEdges.data() + outOffsets[wallet];
    const TransactionID* finish = outEdges.data() + outOffsets[wallet + 1];

    return { start, finish };
}

// ============================================================
// Incoming
// ============================================================
EdgeView Graph::getIncoming(WalletID wallet) const
{
    if (wallet >= numWallets)
    {
        throw std::out_of_range("Invalid wallet");
    }

    const TransactionID* start = inEdges.data() + inOffsets[wallet];
    const TransactionID* finish = inEdges.data() + inOffsets[wallet + 1];

    return { start, finish };
}

// ============================================================
// Wallet count
// ============================================================
size_t Graph::walletCount() const
{
    return numWallets;
}
