module.exports = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer", // analyzes commits with conventional-changelog standrd
    "@semantic-release/release-notes-generator", // generates changelog content based on conventional-changelog standard
    "@semantic-release/changelog", // updates CHANGELOG.md
    "@semantic-release/npm", // updates version in package.json based on commits
    "@semantic-release/git"
  ],
};
