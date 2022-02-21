type Account = {
    privateKey: string;
    balance: string;
    address: string;
};

type MockAccount = {
    secretKey: string;
    balance: string;
};

export const accounts: Account[] = [
    {
        privateKey:
            "637046860574eaa8c343543afddf847f12961d20d32e15f36e7d80f0940731d8",
        balance: "100000000000000000000000000000",
        address: "0x3CD22e0deC3a97DC124cA0304B02FEF139117C05",
    },
    {
        privateKey:
            "d80254c485f6bbdf3c0c5643195d924dbea82907fb75c5bd140699606eb219d0",
        balance: "100000000000000000000000000000",
        address: "0x146198728B605Dc316671E0c5f9B968c61cB6fD1",
    },
    {
        privateKey:
            "1bcd2903c954c34f451f0e7d72fa6bd2cf9d97e452afaa599943cfc3480efdae",
        balance: "100000000000000000000000000000",
        address: "0xb3D86ffEa5836eAbE458Fa29797677E1ba109A0B",
    },
    {
        privateKey:
            "f60f6d9b46bf1482078fb26b98c1d6c11a43d308f33f4c3afa194346c7e8b335",
        balance: "100000000000000000000000000000",
        address: "0xA9d2D4A894fd1C4d4dBe321FB65c20267Fbe7C0D",
    },
    {
        privateKey:
            "2ddfe2a281b5e8f2f95c7a61918f9453196c94930611bb33cc5f07e7d6a7ff57",
        balance: "100000000000000000000000000000",
        address: "0x43E63b38740845EFaC91aaEdcb209e0704C1Bca2",
    },
];

export const mockAccounts: MockAccount[] = accounts.map((a) => ({
    secretKey: a.privateKey,
    balance: a.balance,
}));
