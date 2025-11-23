# DidCard - The FHE-based Decentralized ID Card

DidCard is a privacy-preserving application that leverages Zama's Fully Homomorphic Encryption (FHE) technology to secure personal identification data while allowing seamless age verification without exposing sensitive information such as date of birth. By utilizing advanced cryptographic techniques, DidCard ensures that users maintain control over their digital identity in a decentralized manner.

## The Problem

In a world where personal data is frequently stored and shared online, safeguarding sensitive identification information has become paramount. Traditional methods of managing identity cards often expose cleartext data, leading to potential misuse, identity theft, or unauthorized access. When age verification is required, users are compelled to disclose their birth dates, which further endangers their privacy. DidCard addresses these issues by providing a solution that retains user privacy while allowing necessary verification processes to occur securely.

## The Zama FHE Solution

Fully Homomorphic Encryption enables computations to be performed directly on encrypted data, meaning that sensitive information never has to be revealed in its unencrypted form. DidCard harnesses the power of Zama's FHE technology, specifically using the fhevm library to process encrypted inputs. This allows the application to perform necessary verifications—such as confirming someone's age—without revealing any underlying personal data. This not only enhances the security of the user's identity data but also ensures compliance with privacy regulations.

## Key Features

- 🔒 **Privacy-Centric**: Ensures that sensitive identification data remains encrypted throughout its lifecycle.
- 📱 **Seamless Age Verification**: Enables verification processes without the need to expose the user's birth date.
- 🛠️ **Decentralized Storage**: Stores encrypted identity information on-chain, ensuring data integrity and availability.
- 📊 **User Control**: Provides users with full control over their identity data.
- 🎟️ **QR Code Integration**: Facilitates easy sharing and verification through QR codes, enhancing usability while maintaining privacy.

## Technical Architecture & Stack

The DidCard application is built upon a robust architecture designed to maximize security and privacy. Below is the core technology stack:

- **Frontend**: React / Angular (for user interface)
- **Backend**: Node.js (for application logic and API)
- **Blockchain Layer**: Ethereum (for decentralized storage)
- **Privacy Engine**: Zama's fhevm for fully homomorphic encryption processes

## Smart Contract / Core Logic

Here's a simplified pseudo-code snippet illustrating how DidCard utilizes Zama's FHE technology to verify age without revealing the birth date:

```solidity
pragma solidity ^0.8.0;

import "ZamaFHE.sol"; // Hypothetical import representing Zama's library

contract DidCard {
    struct UserIdentity {
        EncryptedData idData; // Encrypted identification information
        // Other necessary fields...
    }

    mapping(address => UserIdentity) identities;

    function registerUser(EncryptedData memory _idData) public {
        identities[msg.sender] = UserIdentity({ idData: _idData });
    }

    function verifyAge(EncryptedData memory _encryptedBirthDate) public view returns (bool) {
        uint64 age = FHE.decrypt(TFHE.decrypt(_encryptedBirthDate));
        return age >= 18; // Checks if the user is of legal age
    }
}
```

## Directory Structure

Below is the directory structure of the DidCard project:

```
DidCard/
├── contracts/
│   └── DidCard.sol
├── src/
│   ├── components/
│   │   └── UserRegistration.jsx
│   └── services/
│       └── identityService.js
├── tests/
│   └── DidCard.test.js
├── package.json
├── README.md
└── .env
```

## Installation & Setup

To get started with DidCard, please follow these steps:

### Prerequisites

- Node.js installed on your machine
- A code editor (e.g., Visual Studio Code)

### Installation Steps

1. Install project dependencies using npm:
   ```bash
   npm install
   ```
   
2. Install the Zama library:
   ```bash
   npm install fhevm
   ```

### Setup Environment Variables

Create a `.env` file in the root directory and specify the necessary environment variables.

## Build & Run

To compile the smart contracts and run the application, you can use the following commands:

1. Compile the smart contracts:
   ```bash
   npx hardhat compile
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Run the tests:
   ```bash
   npx hardhat test
   ```

## Acknowledgements

We extend our heartfelt gratitude to Zama for providing the open-source FHE primitives that make DidCard possible. Their innovative technology empowers developers to create secure and privacy-centric applications that enable users to control their digital identities while protecting sensitive information.

---

By implementing DidCard, you are not only adopting an advanced privacy-preserving solution but also contributing to a future where individuals have complete control over their personal data. Join us in revolutionizing digital identity management with Zama's powerful FHE technology!


