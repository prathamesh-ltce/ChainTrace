#include "../include/QueryResult.h"
#include <iostream>
#include <sstream>
#include <iomanip>

static std::string walletTypeStr(WalletType type)
{
    switch (type)
    {
        case WalletType::SUSPECT: return "SUSPECT";
        case WalletType::INTERMEDIARY: return "INTERMEDIARY";
        case WalletType::VASP: return "VASP";
        case WalletType::MIXER: return "MIXER";
        case WalletType::BRIDGE: return "BRIDGE";
        default: return "UNKNOWN";
    }
}

static std::string escapeJson(const std::string& s)
{
    std::ostringstream o;
    for (char c : s)
    {
        switch (c)
        {
            case '"': o << "\\\""; break;
            case '\\': o << "\\\\"; break;
            case '\b': o << "\\b"; break;
            case '\f': o << "\\f"; break;
            case '\n': o << "\\n"; break;
            case '\r': o << "\\r"; break;
            case '\t': o << "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) <= 0x1f)
                {
                    o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                }
                else
                {
                    o << c;
                }
        }
    }
    return o.str();
}

std::string QueryResult::toJson() const
{
    std::ostringstream oss;
    oss << "{\n";

    // Source Wallet Context
    oss << "  \"source\": {\n";
    oss << "    \"walletId\": " << (sourceWalletId == INVALID_WALLET ? "null" : std::to_string(sourceWalletId)) << ",\n";
    oss << "    \"address\": \"" << escapeJson(sourceAddress) << "\"\n";
    oss << "  },\n";
    
    // Stats
    oss << "  \"stats\": {\n";
    oss << "    \"nodesCount\": " << stats.nodesCount << ",\n";
    oss << "    \"edgesCount\": " << stats.edgesCount << ",\n";
    oss << "    \"nodesVisited\": " << stats.nodesVisited << ",\n";
    oss << "    \"edgesExamined\": " << stats.edgesExamined << ",\n";
    oss << "    \"executionTimeUs\": " << stats.executionTimeUs << ",\n";
    oss << "    \"truncated\": " << (stats.truncated ? "true" : "false") << "\n";
    oss << "  },\n";

    // Nodes
    oss << "  \"nodes\": [\n";
    for (size_t i = 0; i < nodes.size(); ++i)
    {
        const auto& n = nodes[i];
        oss << "    {\n";
        oss << "      \"id\": " << n.walletId << ",\n";
        oss << "      \"address\": \"" << escapeJson(n.address) << "\",\n";
        oss << "      \"label\": \"" << escapeJson(n.label) << "\",\n";
        oss << "      \"type\": \"" << walletTypeStr(n.type) << "\",\n";
        oss << "      \"depth\": " << n.depth << ",\n";
        oss << "      \"parentId\": " << (n.parentWallet == INVALID_WALLET ? "null" : std::to_string(n.parentWallet)) << "\n";
        oss << "    }" << (i + 1 < nodes.size() ? "," : "") << "\n";
    }
    oss << "  ],\n";

    // Edges
    oss << "  \"edges\": [\n";
    for (size_t i = 0; i < edges.size(); ++i)
    {
        const auto& e = edges[i];
        oss << "    {\n";
        oss << "      \"txId\": " << e.txId << ",\n";
        oss << "      \"from\": " << e.from << ",\n";
        oss << "      \"to\": " << e.to << ",\n";
        oss << "      \"amountUnits\": " << e.amount << ",\n";
        oss << "      \"amountFormatted\": \"" << formatCryptoAmount(e.amount, e.asset) << "\",\n";
        oss << "      \"timestamp\": " << e.timestamp << ",\n";
        oss << "      \"asset\": \"" << escapeJson(e.asset) << "\",\n";
        oss << "      \"direction\": \"" << (e.direction == Direction::FORWARD ? "FORWARD" : "BACKWARD") << "\"\n";
        oss << "    }" << (i + 1 < edges.size() ? "," : "") << "\n";
    }
    oss << "  ]\n";

    oss << "}\n";
    return oss.str();
}

void QueryResult::printSummary() const
{
    std::cout << "--- Subgraph Query Summary ---\n";
    std::cout << "Source: " << (sourceAddress.empty() ? ("W_" + std::to_string(sourceWalletId)) : sourceAddress) << "\n";
    std::cout << "Nodes Returned: " << stats.nodesCount << " | Edges Returned: " << stats.edgesCount << "\n";
    std::cout << "Nodes Visited : " << stats.nodesVisited << " | Edges Examined: " << stats.edgesExamined << "\n";
    std::cout << "Duration: " << stats.executionTimeUs << " us"
              << (stats.truncated ? " [TRUNCATED]" : "") << "\n";
}
