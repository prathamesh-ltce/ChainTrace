#pragma once

#include <cstdint>
#include <string>
#include <sstream>
#include <iomanip>
#include <cmath>

// ============================================================
// Compact IDs
// ============================================================

using WalletID = uint32_t;
using TransactionID = uint32_t;

// Exact integer/fixed-point base units representation
using Amount = uint64_t;

// Standard scale: 8 decimal places (1.0 = 100,000,000 base units)
constexpr uint64_t DEFAULT_AMOUNT_SCALE = 100000000ULL;
constexpr uint8_t DEFAULT_AMOUNT_DECIMALS = 8;

// ============================================================
// Amount Conversion Helpers
// ============================================================

inline Amount doubleToAmount(double val, uint64_t scale = DEFAULT_AMOUNT_SCALE)
{
    if (val < 0.0) return 0;
    return static_cast<Amount>(std::round(val * static_cast<double>(scale)));
}

inline double amountToDouble(Amount val, uint64_t scale = DEFAULT_AMOUNT_SCALE)
{
    return static_cast<double>(val) / static_cast<double>(scale);
}

inline Amount parseAmount(const std::string& str, uint8_t decimals = DEFAULT_AMOUNT_DECIMALS)
{
    if (str.empty()) return 0;

    size_t dotPos = str.find('.');
    if (dotPos == std::string::npos)
    {
        uint64_t whole = std::stoull(str);
        uint64_t scale = 1;
        for (uint8_t i = 0; i < decimals; ++i) scale *= 10;
        return whole * scale;
    }

    std::string wholeStr = str.substr(0, dotPos);
    std::string fracStr = str.substr(dotPos + 1);

    uint64_t whole = wholeStr.empty() ? 0 : std::stoull(wholeStr);

    if (fracStr.length() > decimals)
    {
        fracStr = fracStr.substr(0, decimals);
    }
    else
    {
        while (fracStr.length() < decimals)
        {
            fracStr += '0';
        }
    }

    uint64_t frac = fracStr.empty() ? 0 : std::stoull(fracStr);

    uint64_t scale = 1;
    for (uint8_t i = 0; i < decimals; ++i) scale *= 10;

    return whole * scale + frac;
}

inline std::string formatAmount(Amount val, uint8_t decimals = DEFAULT_AMOUNT_DECIMALS)
{
    uint64_t scale = 1;
    for (uint8_t i = 0; i < decimals; ++i) scale *= 10;

    uint64_t whole = val / scale;
    uint64_t frac = val % scale;

    std::ostringstream oss;
    oss << whole << '.' << std::setw(decimals) << std::setfill('0') << frac;
    
    // Trim trailing zeros after decimal point for cleaner output
    std::string s = oss.str();
    size_t lastNonZero = s.find_last_not_of('0');
    if (lastNonZero != std::string::npos)
    {
        if (s[lastNonZero] == '.')
        {
            s = s.substr(0, lastNonZero + 2); // keep at least 1 zero e.g. "1.0"
        }
        else
        {
            s = s.substr(0, lastNonZero + 1);
        }
    }
    return s;
}

// ============================================================
// Multi-Cryptocurrency Decimal Registry & Asset Normalization
// Supports: BTC, ETH, USDT, USDC, SOL, TRX, XRP, DOGE, ADA, BNB, etc.
// ============================================================

struct CryptoAsset
{
    static uint8_t getDecimals(const std::string& symbol)
    {
        // 6 Decimals (Tether, USD Coin, Tron, Ripple, Cardano)
        if (symbol == "USDT" || symbol == "USDC" || symbol == "TRX" || symbol == "XRP" || symbol == "ADA")
        {
            return 6;
        }
        // 8 Decimals (Bitcoin, Dogecoin, Litecoin)
        if (symbol == "BTC" || symbol == "DOGE" || symbol == "LTC")
        {
            return 8;
        }
        // 9 Decimals (Solana Lamports)
        if (symbol == "SOL")
        {
            return 9;
        }
        // 10 Decimals (Polkadot Plancks)
        if (symbol == "DOT")
        {
            return 10;
        }
        // Normalized 8 Decimals for EVM standard integer accounting (ETH, BNB, MATIC/POL, AVAX)
        if (symbol == "ETH" || symbol == "BNB" || symbol == "MATIC" || symbol == "POL" || symbol == "AVAX")
        {
            return 8;
        }
        // Default standard precision
        return DEFAULT_AMOUNT_DECIMALS;
    }

    static uint64_t getScale(const std::string& symbol)
    {
        uint8_t dec = getDecimals(symbol);
        uint64_t scale = 1;
        for (uint8_t i = 0; i < dec; ++i) scale *= 10;
        return scale;
    }
};

inline Amount parseCryptoAmount(const std::string& str, const std::string& symbol)
{
    return parseAmount(str, CryptoAsset::getDecimals(symbol));
}

inline std::string formatCryptoAmount(Amount val, const std::string& symbol)
{
    return formatAmount(val, CryptoAsset::getDecimals(symbol));
}

inline Amount doubleToCryptoAmount(double val, const std::string& symbol)
{
    return doubleToAmount(val, CryptoAsset::getScale(symbol));
}

inline double cryptoAmountToDouble(Amount val, const std::string& symbol)
{
    return amountToDouble(val, CryptoAsset::getScale(symbol));
}

// ============================================================
// Invalid IDs
// ============================================================

constexpr WalletID INVALID_WALLET = UINT32_MAX;
constexpr TransactionID INVALID_TRANSACTION = UINT32_MAX;

// ============================================================
// Direction & Algorithm Enums
// ============================================================

enum class Direction : uint8_t
{
    FORWARD = 0,    // Follow fund flows downstream (from -> to)
    BACKWARD = 1,   // Trace origin upstream (to -> from)
    BOTH = 2        // Bidirectional
};

enum class Algorithm : uint8_t
{
    BFS = 0,
    DFS = 1
};

// ============================================================
// Wallet types
// ============================================================

enum class WalletType : uint8_t
{
    UNKNOWN = 0,
    SUSPECT,
    INTERMEDIARY,
    VASP,
    MIXER,
    BRIDGE
};

// ============================================================
// Wallet metadata
// ============================================================

struct Wallet
{
    WalletID id;
    std::string address;
    WalletType type;
    std::string label;
};

// ============================================================
// Transaction
// Stored ONCE in TransactionStore.
// Graph stores only compact TransactionIDs.
// ============================================================

struct Transaction
{
    TransactionID id;
    WalletID from;
    WalletID to;
    Amount amount;       // Exact fixed-point integer base units
    uint64_t timestamp;  // Epoch timestamp (seconds)
    std::string asset;   // ETH, BTC, etc.
};

// ============================================================
// Backward compatibility Result node
// ============================================================

struct TraceNode
{
    WalletID wallet;
    TransactionID viaTransaction;
    WalletID parent;
    uint32_t depth;
};