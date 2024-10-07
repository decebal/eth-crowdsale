//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./Token.sol";

contract OwlCrowdsale {
    address owner;
    Token public token;
    uint256 public price;
    uint256 public maxTokens;
    uint256 public tokensSold;
    uint256 public deadline;
    uint256 public currentTime;
    uint256 public minContribution;
    uint256 public maxContribution;

    event Buy(uint256 amount, address buyer);
    event Finalize(uint256 tokensSold, uint256 ethRaised);

    mapping(address => bool) public whitelist;

    constructor(
        Token _token,
        uint256 _price,
        uint256 _maxTokens,
        uint256 _deadline,
        uint256 _minContribution,
        uint256 _maxContribution
    ) {
        owner = msg.sender;
        token = _token;
        price = _price;
        maxTokens = _maxTokens;
        deadline = _deadline;
        minContribution = _minContribution;
        maxContribution = _maxContribution;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    modifier onlyWhitelist() {
        require(whitelist[msg.sender], "Caller is not on the whitelist");
        _;
    }

    modifier onlyWhenOpen() {
        require(block.timestamp <= deadline, "The crowdsale is closed");
        _;
    }

    // Buy tokens directly by sending Ether
    // --> https://docs.soliditylang.org/en/v0.8.15/contracts.html#receive-ether-function

    receive() external payable onlyWhitelist onlyWhenOpen {
        uint256 amount = msg.value / price;
        buyTokens(amount * 1e18);
    }

    function isOpen() public view returns (bool) {
        return block.timestamp <= deadline;
    }

    function buyTokens(uint256 _amount) public payable onlyWhitelist onlyWhenOpen {
        require(msg.value == (_amount / 1e18) * price, "Insufficient ETH");
        require(token.balanceOf(address(this)) >= _amount, "Insufficient Tokens");
        require(_amount >= minContribution * 1e18, "Tokens amount is below minimum required");
        require(_amount <= maxContribution * 1e18, "Tokens amount is above maximum allowed");
        require(token.transfer(msg.sender, _amount));

        tokensSold += _amount;

        emit Buy(_amount, msg.sender);
    }

    function setPrice(uint256 _price) public onlyOwner {
        price = _price;
    }

    // Finalize Sale
    function finalize() public onlyOwner {
        require(token.transfer(owner, token.balanceOf(address(this))));

        uint256 value = address(this).balance;
        (bool sent,) = owner.call{value: value}("");
        require(sent);

        emit Finalize(tokensSold, value);
    }

    //owner to add address to whitelist
    function whitelistAddress(address _address) public onlyOwner {
        whitelist[_address] = true;
    }
}
