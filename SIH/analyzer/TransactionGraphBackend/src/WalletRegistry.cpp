#include "../include/WalletRegistry.h"

#include <stdexcept>


// ============================================================
// Get or create wallet
// ============================================================

WalletID WalletRegistry::getOrCreate(
    const std::string& address)
{
    auto it = addressToID.find(address);

    if (it != addressToID.end())
    {
        return it->second;
    }


    WalletID id =
        static_cast<WalletID>(wallets.size());


    addressToID.emplace(
        address,
        id
    );


    wallets.push_back({
        id,
        address,
        WalletType::UNKNOWN,
        ""
    });


    return id;
}


// ============================================================
// Find wallet
// ============================================================

WalletID WalletRegistry::find(
    const std::string& address) const
{
    auto it = addressToID.find(address);

    if (it == addressToID.end())
    {
        return INVALID_WALLET;
    }

    return it->second;
}


// ============================================================
// Update wallet information
// ============================================================

bool WalletRegistry::setInfo(
    const std::string& address,
    WalletType type,
    const std::string& label,
    bool createIfMissing)
{
    WalletID id = createIfMissing
        ? getOrCreate(address)
        : find(address);

    if (id == INVALID_WALLET)
    {
        return false;
    }

    wallets[id].type = type;
    wallets[id].label = label;
    return true;
}


// ============================================================
// Get wallet
// ============================================================

const Wallet& WalletRegistry::get(
    WalletID id) const
{
    if (id >= wallets.size())
    {
        throw std::out_of_range(
            "Invalid WalletID"
        );
    }

    return wallets[id];
}


// ============================================================
// Size
// ============================================================

size_t WalletRegistry::size() const
{
    return wallets.size();
}