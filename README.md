## Publishing Node.js Modules on AWS CodeArtifact using AWS CodePipeline

Code reuse is hard. When writing code for Node.js, developers can take advantage of the Node.js Package Manager (NPM) Command Line Interface (CLI) that enables packaging code into modules which can then reused across projects. These modules or packages can be stored in AWS CodeArtifact and used throughout Node.js applications running on AWS. This pattern provides a continuous integration - continuous deployment pipeline via AWS CodePipeline to lint, test, and publish a new version of a Node.js module into a AWS CodeArtifact Repository. The publish stage of the pipeline uses semantic-release, a fully automated version management and package publishing tool. Semantic release automatically creates a CHANGELOG.md based off your commit messages and updates the version in your package.json via semantic version guidelines. The pipeline and supporting infrastructure is defined via the AWS Cloud Development Kit (CDK).

See the associated Amazon Prescriptive Guidance (APG) Pattern [here](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/aws-codepipeline-publish-nodejs-modules) for further information.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

