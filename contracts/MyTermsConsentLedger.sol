// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MyTermsConsentLedger {
    event ConsentLogged(
        address indexed user,
        string siteDomain,
        bytes32 termsHash,
        uint256 timestamp
    );

    function logConsentBatch(
        string[] calldata sites,
        bytes32[] calldata hashes
    ) external {
        require(sites.length == hashes.length, "Mismatched input lengths");

        for (uint256 i = 0; i < sites.length; i++) {
            emit ConsentLogged(msg.sender, sites[i], hashes[i], block.timestamp);
        }
    }

    function logConsent(
        string calldata site,
        bytes32 termsHash
    ) external {
        emit ConsentLogged(msg.sender, site, termsHash, block.timestamp);
    }
}
