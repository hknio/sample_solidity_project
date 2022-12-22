#### NOTICE: This project is solely intended as an example of Solidity project setup and documentation, and is not intended for use in production as its safety is not guaranteed.

# Sample Solidity Project
This sample Solidity project is an example of a properly configured environment, featuring everything that is needed to get up and running quickly, such as comprehensive documentation, robust testing, and a comprehensive development setup. All of these features come together to ensure that the project is well organized, easily maintainable and above all efficient to audit. 

A properly set up project makes it possible for the auditors to spend more time on the detailed analysis of the code, maximizing the value of clients' investments.

# Specifications
### Project Overview
Sample Solidity project is an ERC20 based vesting project. It allows owners to create multiple payment plans and deposit tokens to allow users to receive those funds in a way described by the plan. 

The vesting contract allows users to set a start date, end date, and amount of tokens that will be released at the end of the vesting period. This allows users to set a schedule of token releases and ensures that tokens are released over a fixed period of time. Furthermore, the contract also allows users to set a cliff period, which means that no tokens will be released until the cliff period is over. This ensures that users will have a vested interest in the project and will not receive tokens until they have committed to the project for a certain length of time.

### Functional, Technical Requirements
Functional and Technical Requirements can be found in the [Requirements.pdf](./docs/Requirements.pdf) document

# Getting Started
Recommended Node version is 16.0.0 and above.

### Available commands

```bash
# install dependencies
$ npm install

# build for production
$ npm run build

# clean, build, run tests
$ npm run rebuild

# run tests
$ npm run test

# compute tests coverage
$ npm run coverage

# eslint automatically fix problems
$ npm run lint

# run pretty-quick on .ts , .tsx files
$ npm run lint-quick
```

# Project Structure
This a template hardhat typescript project composed of contracts, tests, and deploy instructions that provides a great starting point for developers to quickly get up and running and deploying smart contracts on the Ethereum blockchain.

## Tests

Tests are found in the `./test/` folder. `./test/shared/` contains various test helpers. No additional keys are required to run the tests.

Both positive and negative cases are covered, and test coverage is 100%.

## Contracts

Solidity smart contracts are found in `./contracts/`

`./contracts/mocks` folder contains contracts mocks that are used for testing purposes.

## Deploy
Deploy script can be found in the `deploy.ts` folder.

Rename `./.env.example` to `./.env` in the project root.
To add the private key of a deployer account, assign the following variables
```
PRIVATE_KEY=...
TOKEN_ADDRESS=...
```
example:
```bash
$ npm run deploy -- mumbai
```
