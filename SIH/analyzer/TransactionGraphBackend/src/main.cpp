#include "../include/WalletRegistry.h"
#include "../include/TransactionStore.h"
#include "../include/Graph.h"
#include "../include/TraceEngine.h"
#include "../include/QueryResult.h"

#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <chrono>


// ============================================================
// CSV split
// ============================================================

std::vector<std::string>
splitCSV(const std::string& line)
{
    std::vector<std::string> fields;

    std::stringstream stream(line);

    std::string field;

    while (std::getline(stream, field, ','))
    {
        fields.push_back(field);
    }

    return fields;
}


// ============================================================
// Convert WalletType to string.
// ============================================================

std::string walletTypeToString(
    WalletType type)
{
    switch (type)
    {
        case WalletType::SUSPECT:
            return "SUSPECT";

        case WalletType::INTERMEDIARY:
            return "INTERMEDIARY";

        case WalletType::VASP:
            return "VASP";

        case WalletType::MIXER:
            return "MIXER";

        case WalletType::BRIDGE:
            return "BRIDGE";

        default:
            return "UNKNOWN";
    }
}


// ============================================================
// Load CSV.
//
// Important:
// Every new wallet gets a graph slot.
// ============================================================

bool loadTransactions(
    const std::string& filename,
    WalletRegistry& registry,
    TransactionStore& store,
    Graph& graph)
{
    std::ifstream file(filename);

    if (!file)
    {
        std::cerr
            << "ERROR: Could not open "
            << filename
            << '\n';

        return false;
    }


    std::string line;


    // Skip header.
    std::getline(
        file,
        line
    );


    while (std::getline(
        file,
        line))
    {
        if (line.empty())
        {
            continue;
        }


        auto fields =
            splitCSV(line);


        if (fields.size() < 6)
        {
            std::cerr
                << "Skipping invalid row:\n"
                << line
                << '\n';

            continue;
        }


        const std::string& txHash =
            fields[0];

        const std::string& from =
            fields[1];

        const std::string& to =
            fields[2];

        uint64_t timestamp =
            std::stoull(fields[4]);

        const std::string& asset =
            fields[5];

        Amount amount =
            parseCryptoAmount(fields[3], asset);


        // ----------------------------------------------------
        // Count wallets BEFORE adding transaction.
        // ----------------------------------------------------

        size_t before =
            registry.size();


        // ----------------------------------------------------
        // Store transaction.
        // This creates wallets when necessary.
        // ----------------------------------------------------

        TransactionID txID =
            store.add(
                registry,
                txHash,
                from,
                to,
                amount,
                timestamp,
                asset
            );


        (void)before;
    }

    return true;
}


// ============================================================
// Print investigation tree.
// ============================================================

void printTrace(
    const WalletRegistry& registry,
    const TransactionStore& transactions,
    const std::vector<TraceNode>& trace)
{
    std::cout
        << "\n========================================\n";

    std::cout
        << "        INVESTIGATION TRACE\n";

    std::cout
        << "========================================\n";


    for (const TraceNode& node :
         trace)
    {
        const Wallet& wallet =
            registry.get(
                node.wallet
            );


        // ----------------------------------------------------
        // Indentation.
        // ----------------------------------------------------

        for (uint16_t i = 0;
             i < node.depth;
             ++i)
        {
            std::cout
                << "    ";
        }


        if (node.depth > 0)
        {
            std::cout
                << "-> ";
        }


        // ----------------------------------------------------
        // Temporary/internal ID.
        // ----------------------------------------------------

        std::cout
            << "W_TMP_"
            << std::setw(6)
            << std::setfill('0')
            << (node.wallet + 1)
            << std::setfill(' ');


        // ----------------------------------------------------
        // Wallet label.
        // ----------------------------------------------------

        std::cout
            << " | "
            << (wallet.label.empty()
                ? wallet.address
                : wallet.label);


        std::cout
            << " | "
            << walletTypeToString(
                wallet.type
            );


        // ----------------------------------------------------
        // Transaction information.
        // ----------------------------------------------------

        if (node.viaTransaction !=
            INVALID_TRANSACTION)
        {
            const Transaction& tx =
                transactions.get(
                    node.viaTransaction
                );


            std::cout
                << " | "
                << formatCryptoAmount(tx.amount, tx.asset)
                << " "
                << tx.asset;


            std::cout
                << " | time="
                << tx.timestamp;
        }


        std::cout << '\n';
    }


    std::cout
        << "\nNodes discovered: "
        << trace.size()
        << '\n';


    std::cout
        << "========================================\n";
}


// ============================================================
// Classification & Intelligence
// Annotates only wallets that are actually present in the dataset.
// Never creates phantom wallets for benchmark datasets.
// ============================================================

void applyIntelligence(WalletRegistry& registry)
{
    // Demo dataset intelligence
    registry.setInfo("WALLET_A", WalletType::SUSPECT, "Suspect Wallet");
    registry.setInfo("WALLET_B", WalletType::INTERMEDIARY, "Intermediary B");
    registry.setInfo("WALLET_C", WalletType::INTERMEDIARY, "Intermediary C");
    registry.setInfo("WALLET_D", WalletType::INTERMEDIARY, "Common Wallet D");
    registry.setInfo("WALLET_E", WalletType::INTERMEDIARY, "Intermediary E");
    registry.setInfo("WALLET_F", WalletType::INTERMEDIARY, "Intermediary F");
    registry.setInfo("VASP_X", WalletType::VASP, "Demo VASP X");
    registry.setInfo("VASP_Y", WalletType::VASP, "Demo VASP Y");
    registry.setInfo("W0", WalletType::SUSPECT, "Root Suspect W0");

    // Dynamic VASP Dataset Lookup
    const std::vector<std::string> vaspCandidates = {
        "../data/vasp_addresses.csv",
        "data/vasp_addresses.csv",
        "analyzer/data/vasp_addresses.csv"
    };
    for (const auto& vpath : vaspCandidates) {
        std::ifstream vf(vpath);
        if (vf.is_open()) {
            std::string line;
            std::getline(vf, line); // header
            while (std::getline(vf, line)) {
                if (line.empty()) continue;
                auto fields = splitCSV(line);
                if (fields.size() >= 3) {
                    const std::string& addr = fields[0];
                    const std::string& name = fields[1];
                    const std::string& type = fields[2];
                    WalletType wt = WalletType::UNKNOWN;
                    if (type == "exchange" || type == "custodial") wt = WalletType::VASP;
                    else if (type == "mixer" || type == "coinjoin_coordinator") wt = WalletType::MIXER;
                    else if (type == "defi_bridge") wt = WalletType::BRIDGE;
                    registry.setInfo(addr, wt, name);
                }
            }
            break;
        }
    }
}


// ============================================================
// Main
// ============================================================

int main(int argc, char* argv[])
{
    std::cout
        << "========================================\n";

    std::cout
        << "   Transaction Graph Backend Engine\n";

    std::cout
        << "========================================\n";


    // --------------------------------------------------------
    // CLI Arguments Parsing
    // --------------------------------------------------------

    std::string filename = "data/transactions.csv";
    std::string sourceAddr = "";
    std::string jsonOutPath = "";
    uint32_t maxDepth = 15;
    size_t maxNodes = 50000;

    for (int i = 1; i < argc; ++i)
    {
        std::string arg = argv[i];
        if (arg == "--source" && i + 1 < argc)
        {
            sourceAddr = argv[++i];
        }
        else if (arg == "--json" && i + 1 < argc)
        {
            jsonOutPath = argv[++i];
        }
        else if (arg == "--max-depth" && i + 1 < argc)
        {
            maxDepth = static_cast<uint32_t>(std::stoul(argv[++i]));
        }
        else if (arg == "--max-nodes" && i + 1 < argc)
        {
            maxNodes = static_cast<size_t>(std::stoul(argv[++i]));
        }
        else if (!arg.empty() && arg[0] != '-')
        {
            filename = arg;
        }
    }

    // --------------------------------------------------------
    // Main backend components.
    // --------------------------------------------------------

    WalletRegistry registry;

    TransactionStore transactions;

    Graph graph;

    TraceEngine traceEngine;


    // --------------------------------------------------------
    // Load data.
    // --------------------------------------------------------

    auto buildStart =
        std::chrono::steady_clock::now();

    if (!loadTransactions(
        filename,
        registry,
        transactions,
        graph))
    {
        return 1;
    }

    auto buildEnd =
        std::chrono::steady_clock::now();

    auto buildTime =
        std::chrono::duration_cast<
            std::chrono::milliseconds
        >(buildEnd - buildStart).count();

    std::cout
        << "\nGraph build time: "
        << buildTime
        << " ms\n";


    // --------------------------------------------------------
    // Add intelligence / classification.
    // Annotates only wallets that exist in the loaded dataset.
    // --------------------------------------------------------
    applyIntelligence(registry);


    // --------------------------------------------------------
    // Build CSR Graph now that all wallets (including hardcoded) are registered.
    // --------------------------------------------------------
    graph.build(registry.size(), transactions);


    // --------------------------------------------------------
    // Statistics & Memory Estimation
    // --------------------------------------------------------

    size_t memRegistry = registry.size() * sizeof(Wallet) + registry.size() * 32; // Approx map overhead
    size_t memStore = transactions.size() * sizeof(Transaction);
    size_t memGraph = (registry.size() * 2 * sizeof(size_t)) + (transactions.size() * 2 * sizeof(TransactionID));
    size_t totalMemBytes = memRegistry + memStore + memGraph;
    double totalMemMB = totalMemBytes / (1024.0 * 1024.0);

    std::cout
        << "\nWallets      : "
        << registry.size()
        << '\n';

    std::cout
        << "Transactions : "
        << transactions.size()
        << '\n';

    std::cout
        << "Approx Memory: "
        << totalMemMB
        << " MB\n";


    // --------------------------------------------------------
    // Find source wallet.
    // --------------------------------------------------------

    WalletID source = INVALID_WALLET;
    if (!sourceAddr.empty())
    {
        source = registry.find(sourceAddr);
        if (source == INVALID_WALLET)
        {
            // Case-insensitive fallback
            std::string lowerSrc = sourceAddr;
            for (auto& c : lowerSrc) c = static_cast<char>(tolower(c));
            for (size_t wid = 0; wid < registry.size(); ++wid)
            {
                std::string cur = registry.get(static_cast<WalletID>(wid)).address;
                for (auto& c : cur) c = static_cast<char>(tolower(c));
                if (cur == lowerSrc)
                {
                    source = static_cast<WalletID>(wid);
                    break;
                }
            }
        }
    }

    if (source == INVALID_WALLET)
    {
        source = registry.find("W0");
    }

    if (source == INVALID_WALLET)
    {
        source = registry.find("WALLET_A");
    }

    if (source == INVALID_WALLET && registry.size() > 0)
    {
        source = 0; // Default to first ingested wallet
    }

    if (source == INVALID_WALLET)
    {
        std::cerr
            << "Source wallet not found.\n";

        return 1;
    }


    // --------------------------------------------------------
    // Run BFS.
    // --------------------------------------------------------

    auto traceStart =
        std::chrono::steady_clock::now();

    auto trace =
        traceEngine.trace(
            source,
            graph,
            transactions,
            maxDepth,
            maxNodes
        );

    auto traceEnd =
        std::chrono::steady_clock::now();

    auto traceTime =
        std::chrono::duration_cast<
            std::chrono::microseconds
        >(traceEnd - traceStart).count();

    std::cout
        << "BFS trace time: "
        << traceTime
        << " microseconds\n";


    // --------------------------------------------------------
    // Print result.
    // --------------------------------------------------------

    printTrace(
        registry,
        transactions,
        trace
    );


    // --------------------------------------------------------
    // Production QueryResult Engine
    // --------------------------------------------------------

    TraceQuery queryParams;
    queryParams.root = source;
    queryParams.direction = Direction::FORWARD;
    queryParams.algorithm = Algorithm::BFS;
    queryParams.maxDepth = maxDepth;
    queryParams.maxNodes = maxNodes;

    QueryResult structuredResult = traceEngine.query(
        queryParams,
        graph,
        transactions,
        registry
    );

    structuredResult.printSummary();

    // Export JSON if requested
    if (!jsonOutPath.empty())
    {
        std::ofstream jf(jsonOutPath);
        if (jf.is_open())
        {
            jf << structuredResult.toJson();
            jf.close();
            std::cout << "[+] Traversal Subgraph JSON exported to: " << jsonOutPath << "\n";
        }
        else
        {
            std::cerr << "[-] Failed to write JSON output to: " << jsonOutPath << "\n";
        }
    }

    return 0;
}