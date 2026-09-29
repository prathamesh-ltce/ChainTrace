#include <cstdint>
#include <fstream>
#include <iostream>
#include <string>

int main(int argc, char* argv[])
{
    // ========================================================
    // STRESS TEST SETTINGS
    // ========================================================
    uint32_t count = 10000;
    if (argc > 1) {
        count = std::stoul(argv[1]);
    }
    
    const uint32_t TRANSACTION_COUNT = count;
    const uint32_t WALLET_COUNT = count / 4;

    // Output file
    const char* OUTPUT_FILE =
        "data/stress_transactions.csv";


    // ========================================================
    // Open file
    // ========================================================

    std::ofstream file(OUTPUT_FILE);

    if (!file)
    {
        std::cerr
            << "ERROR: Could not create "
            << OUTPUT_FILE
            << "\n";

        return 1;
    }


    // ========================================================
    // CSV header
    // ========================================================

    file
        << "tx_id,from,to,amount,timestamp,asset\n";


    // ========================================================
    // Generate transactions
    // ========================================================

    for (uint32_t i = 0;
         i < TRANSACTION_COUNT;
         ++i)
    {
        // Source wallet
        uint32_t from =
            i % WALLET_COUNT;


        // Destination wallet
        uint32_t to =
            (i * 37 + 17) % WALLET_COUNT;


        // Prevent self transaction
        if (from == to)
        {
            to =
                (to + 1) % WALLET_COUNT;
        }


        // Demo amount
        double amount =
            0.01 +
            static_cast<double>(i % 1000) * 0.01;


        // Demo timestamp
        uint64_t timestamp =
            1726228000ULL +
            static_cast<uint64_t>(i);


        // Write CSV row
        file
            << "TX"
            << i
            << ",W"
            << from
            << ",W"
            << to
            << ","
            << amount
            << ","
            << timestamp
            << ",ETH\n";
    }


    // ========================================================
    // Close
    // ========================================================

    file.close();


    // ========================================================
    // Result
    // ========================================================

    std::cout
        << "\n========================================\n";

    std::cout
        << " Stress Test Data Generator\n";

    std::cout
        << "========================================\n";

    std::cout
        << "Transactions generated : "
        << TRANSACTION_COUNT
        << "\n";

    std::cout
        << "Wallet pool             : "
        << WALLET_COUNT
        << "\n";

    std::cout
        << "Output file             : "
        << OUTPUT_FILE
        << "\n";

    std::cout
        << "========================================\n";


    return 0;
}