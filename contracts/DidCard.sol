pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedIDCard is ZamaEthereumConfig {
    struct IdentityCard {
        euint32 encryptedAge;
        uint256 publicData;
        address owner;
        uint256 creationTimestamp;
        bool isVerified;
    }

    mapping(string => IdentityCard) public identityCards;
    string[] public cardIds;

    event CardCreated(string indexed cardId, address indexed owner);
    event AgeVerified(string indexed cardId, uint32 decryptedAge);

    constructor() ZamaEthereumConfig() {}

    function createCard(
        string calldata cardId,
        externalEuint32 encryptedAge,
        bytes calldata inputProof,
        uint256 publicData
    ) external {
        require(identityCards[cardId].owner == address(0), "Card already exists");
        require(FHE.isInitialized(FHE.fromExternal(encryptedAge, inputProof)), "Invalid encrypted age");

        identityCards[cardId] = IdentityCard({
            encryptedAge: FHE.fromExternal(encryptedAge, inputProof),
            publicData: publicData,
            owner: msg.sender,
            creationTimestamp: block.timestamp,
            isVerified: false
        });

        FHE.allowThis(identityCards[cardId].encryptedAge);
        FHE.makePubliclyDecryptable(identityCards[cardId].encryptedAge);

        cardIds.push(cardId);
        emit CardCreated(cardId, msg.sender);
    }

    function verifyAge(
        string calldata cardId,
        bytes memory abiEncodedClearAge,
        bytes memory decryptionProof
    ) external {
        require(identityCards[cardId].owner != address(0), "Card does not exist");
        require(!identityCards[cardId].isVerified, "Age already verified");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(identityCards[cardId].encryptedAge);

        FHE.checkSignatures(cts, abiEncodedClearAge, decryptionProof);
        
        uint32 decodedAge = abi.decode(abiEncodedClearAge, (uint32));
        identityCards[cardId].isVerified = true;

        emit AgeVerified(cardId, decodedAge);
    }

    function getEncryptedAge(string calldata cardId) external view returns (euint32) {
        require(identityCards[cardId].owner != address(0), "Card does not exist");
        return identityCards[cardId].encryptedAge;
    }

    function getCardDetails(string calldata cardId) external view returns (
        uint256 publicData,
        address owner,
        uint256 creationTimestamp,
        bool isVerified
    ) {
        require(identityCards[cardId].owner != address(0), "Card does not exist");
        IdentityCard storage card = identityCards[cardId];

        return (
            card.publicData,
            card.owner,
            card.creationTimestamp,
            card.isVerified
        );
    }

    function getAllCardIds() external view returns (string[] memory) {
        return cardIds;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}


