module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    },
    // Ignore the extension build/dist folders if they exist
    testPathIgnorePatterns: ['/node_modules/'],
    // Setup if needed
    // setupFilesAfterEnv: ['./tests/setup.js'],
};
