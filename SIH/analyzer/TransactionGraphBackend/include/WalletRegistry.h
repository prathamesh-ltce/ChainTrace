#pragma once

#include "Types.h"

#include <string>
#include <unordered_map>
#include <vector>

class WalletRegistry
{
private:

    // Real address -> compact ID
    std::unordered_map<std::string, WalletID> addressToID;

    // Compact ID -> wallet
    std::vector<Wallet> wallets;


public:

    // --------------------------------------------------------
    // Get existing ID or create a new wallet.
    // --------------------------------------------------------

    WalletID getOrCreate(
        const std::string& address);


    // --------------------------------------------------------
    // Find without creating.
    // --------------------------------------------------------

    WalletID find(
        const std::string& address) const;


    // --------------------------------------------------------
    // Update wallet classification.
    // By default, does not create wallet if it doesn't exist.
    // --------------------------------------------------------

    bool setInfo(
        const std::string& address,
        WalletType type,
        const std::string& label,
        bool createIfMissing = false);


    // --------------------------------------------------------
    // Access wallet.
    // --------------------------------------------------------

    const Wallet& get(
        WalletID id) const;


    // --------------------------------------------------------
    // Number of wallets.
    // --------------------------------------------------------

    size_t size() const;
};