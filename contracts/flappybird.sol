// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FlappyScoreStorage {
    mapping(address => uint256) private scores;

    event ScoreUpdated(address indexed player, uint256 newScore);

    // Store or update user's highest score
    function submitScore(uint256 newScore) public {
        require(newScore > scores[msg.sender], "New score must be higher than previous score");
        scores[msg.sender] = newScore;
        emit ScoreUpdated(msg.sender, newScore);
    }

    // View user's best score
    function viewScore(address player) public view returns (uint256) {
        return scores[player];
    }
}
