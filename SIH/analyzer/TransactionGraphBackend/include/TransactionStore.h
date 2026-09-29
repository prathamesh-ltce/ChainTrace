#pragma once

#include "Types.h"
#include "WalletRegistry.h"

#include <cstddef>
#include <string>
#include <vector>

class TransactionStore
{
private:
    std::vector<Transaction> transactions;

public:
    // --------------------------------------------------------
    // Add transaction with exact integer fixed-point amount.
    // --------------------------------------------------------
    TransactionID add(
        WalletRegistry& registry,
        const std::string& txHash,
        const std::string& from,
        const std::string& to,
        Amount amount,
        uint64_t timestamp,
        const std::string& asset);

    // --------------------------------------------------------
    // Convenience overload for double amount (converts to Amount).
    // --------------------------------------------------------
    TransactionID add(
        WalletRegistry& registry,
        const std::string& txHash,
        const std::string& from,
        const std::string& to,
        double amount,
        uint64_t timestamp,
        const std::string& asset);

    // --------------------------------------------------------
    // Get transaction.
    // --------------------------------------------------------
    const Transaction& get(
        TransactionID id) const;

    // --------------------------------------------------------
    // Size.
    // --------------------------------------------------------
    size_t size() const;
};