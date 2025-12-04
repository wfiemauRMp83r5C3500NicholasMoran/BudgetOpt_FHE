// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract BudgetOptFHE is SepoliaConfig {
    struct EncryptedCampaign {
        uint256 id;
        euint32 encryptedBudget;
        euint32 encryptedObjectives;
        euint32 encryptedConstraints;
        uint256 timestamp;
    }

    struct DecryptedCampaign {
        uint256 budget;
        string objectives;
        string constraints;
        bool isRevealed;
    }

    uint256 public campaignCount;
    mapping(uint256 => EncryptedCampaign) public encryptedCampaigns;
    mapping(uint256 => DecryptedCampaign) public decryptedCampaigns;

    mapping(string => euint32) private encryptedChannelAllocations;
    string[] private channelList;

    mapping(uint256 => uint256) private requestToCampaignId;

    event CampaignSubmitted(uint256 indexed id, uint256 timestamp);
    event DecryptionRequested(uint256 indexed id);
    event CampaignDecrypted(uint256 indexed id);

    modifier onlyOwner(uint256 campaignId) {
        _;
    }

    function submitEncryptedCampaign(
        euint32 encryptedBudget,
        euint32 encryptedObjectives,
        euint32 encryptedConstraints
    ) public {
        campaignCount += 1;
        uint256 newId = campaignCount;

        encryptedCampaigns[newId] = EncryptedCampaign({
            id: newId,
            encryptedBudget: encryptedBudget,
            encryptedObjectives: encryptedObjectives,
            encryptedConstraints: encryptedConstraints,
            timestamp: block.timestamp
        });

        decryptedCampaigns[newId] = DecryptedCampaign({
            budget: 0,
            objectives: "",
            constraints: "",
            isRevealed: false
        });

        emit CampaignSubmitted(newId, block.timestamp);
    }

    function requestCampaignDecryption(uint256 campaignId) public onlyOwner(campaignId) {
        EncryptedCampaign storage campaign = encryptedCampaigns[campaignId];
        require(!decryptedCampaigns[campaignId].isRevealed, "Already decrypted");

        bytes32[] memory ciphertexts = new bytes32[](3);
        ciphertexts[0] = FHE.toBytes32(campaign.encryptedBudget);
        ciphertexts[1] = FHE.toBytes32(campaign.encryptedObjectives);
        ciphertexts[2] = FHE.toBytes32(campaign.encryptedConstraints);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptCampaign.selector);
        requestToCampaignId[reqId] = campaignId;

        emit DecryptionRequested(campaignId);
    }

    function decryptCampaign(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 campaignId = requestToCampaignId[requestId];
        require(campaignId != 0, "Invalid request");

        EncryptedCampaign storage eCampaign = encryptedCampaigns[campaignId];
        DecryptedCampaign storage dCampaign = decryptedCampaigns[campaignId];
        require(!dCampaign.isRevealed, "Already decrypted");

        FHE.checkSignatures(requestId, cleartexts, proof);

        (uint256 budget, string memory objectives, string memory constraints) = abi.decode(cleartexts, (uint256, string, string));

        dCampaign.budget = budget;
        dCampaign.objectives = objectives;
        dCampaign.constraints = constraints;
        dCampaign.isRevealed = true;

        if (!FHE.isInitialized(encryptedChannelAllocations[objectives])) {
            encryptedChannelAllocations[objectives] = FHE.asEuint32(0);
            channelList.push(objectives);
        }
        encryptedChannelAllocations[objectives] = FHE.add(encryptedChannelAllocations[objectives], FHE.asEuint32(1));

        emit CampaignDecrypted(campaignId);
    }

    function getDecryptedCampaign(uint256 campaignId) public view returns (
        uint256 budget,
        string memory objectives,
        string memory constraints,
        bool isRevealed
    ) {
        DecryptedCampaign storage c = decryptedCampaigns[campaignId];
        return (c.budget, c.objectives, c.constraints, c.isRevealed);
    }

    function getEncryptedChannelAllocation(string memory channel) public view returns (euint32) {
        return encryptedChannelAllocations[channel];
    }

    function requestChannelAllocationDecryption(string memory channel) public {
        euint32 count = encryptedChannelAllocations[channel];
        require(FHE.isInitialized(count), "Channel not found");

        bytes32[] memory ciphertexts = new bytes32[](1);
        ciphertexts[0] = FHE.toBytes32(count);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptChannelAllocation.selector);
        requestToCampaignId[reqId] = bytes32ToUint(keccak256(abi.encodePacked(channel)));
    }

    function decryptChannelAllocation(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 channelHash = requestToCampaignId[requestId];
        string memory channel = getChannelFromHash(channelHash);

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 count = abi.decode(cleartexts, (uint32));
    }

    function bytes32ToUint(bytes32 b) private pure returns (uint256) {
        return uint256(b);
    }

    function getChannelFromHash(uint256 hash) private view returns (string memory) {
        for (uint i = 0; i < channelList.length; i++) {
            if (bytes32ToUint(keccak256(abi.encodePacked(channelList[i]))) == hash) {
                return channelList[i];
            }
        }
        revert("Channel not found");
    }
}
