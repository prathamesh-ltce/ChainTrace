#include "../include/TransactionStore.h"

#include <stdexcept>

// ============================================================
// Add transaction with exact Amount
// ============================================================

TransactionID TransactionStore::add(
    WalletRegistry& registry,
    const std::string& txHash,
    const std::string& from,
    const std::string& to,
    Amount amount,
    uint64_t timestamp,
    const std::string& asset)
{
    (void)txHash;

    WalletID fromID = registry.getOrCreate(from);
    WalletID toID = registry.getOrCreate(to);

    TransactionID id = static_cast<TransactionID>(transactions.size());

    transactions.push_back({
        id,
        fromID,
        toID,
        amount,
        timestamp,
        asset
    });

    return id;
}

// ============================================================
// Convenience overload for double amount
// ============================================================

TransactionID TransactionStore::add(
    WalletRegistry& registry,
    const std::string& txHash,
    const std::string& from,
    const std::string& to,
    double amount,
    uint64_t timestamp,
    const std::string& asset)
{
    return add(
        registry,
        txHash,
        from,
        to,
        doubleToAmount(amount),
        timestamp,
        asset
    );
}

// ============================================================
// Get transaction
// ============================================================

const Transaction& TransactionStore::get(
    TransactionID id) const
{
    if (id >= transactions.size())
    {
        throw std::out_of_range(
            "Invalid TransactionID"
        );
    }

    return transactions[id];
}

// ============================================================
// Size
// ============================================================

size_t TransactionStore::size() const
{
    return transactions.size();
}