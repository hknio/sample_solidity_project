// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenMock is ERC20 {

    constructor (string memory name, string memory symbol) ERC20(name, symbol){}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        _burn(account, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
