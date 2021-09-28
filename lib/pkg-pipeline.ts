// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Arn, CfnOutput, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Repository } from "aws-cdk-lib/lib/aws-codecommit";
import { Artifact, Pipeline } from "aws-cdk-lib/lib/aws-codepipeline";
import {
  BuildSpec,
  ComputeType,
  LinuxBuildImage,
  PipelineProject,
} from "aws-cdk-lib/lib/aws-codebuild";
import {
  CodeBuildAction,
  CodeBuildActionType,
  CodeCommitSourceAction,
  CodeCommitTrigger,
} from "aws-cdk-lib/lib/aws-codepipeline-actions";
import { PolicyStatement } from "aws-cdk-lib/lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/lib/aws-lambda-nodejs";
import { LambdaFunction } from "aws-cdk-lib/lib/aws-events-targets";
import { resolve } from "path";
import { existsSync } from "fs";

interface PkgPipelineProps {
  /**
   * @default LinuxBuildImage.STANDARD_5_0
   */
  buildImage?: LinuxBuildImage;
  /**
   * Code Artifact Domain Name
   */
  codeArtifactDomain: string;
  /**
   * Code Artifact Repository Name
   */
  codeArtifactRepo: string;
  /**
   * Code Artifact Namespace
   */
  codeArtifactNamespace: string;
  /**
   * @default ComputeType.MEDIUM
   */
  computeType?: ComputeType;
  lintCommands?: {
    /**
     * @default globalInstallCommands
     */
    install?: string[];
    /**
     * @default globalPreBuildCommands
     */
    pre_build?: string[];
    /**
     * @default ["npm run lint"]
     */
    build?: string[];
    /**
     * @default undefined
     */
    post_build?: string[];
  };
  testCommands?: {
    /**
     * @default globalInstallCommands
     */
    install?: string[];
    /**
     * @default globalPreBuildCommands
     */
    pre_build?: string[];
    /**
     * @default ["npm run test"]
     */
    build?: string[];
    /**
     * @default undefined
     */
    post_build?: string[];
  };
  releaseCommands?: {
    /**
     * @default globalInstallCommands
     */
    install?: string[];
    /**
     * @default globalPreBuildCommands
     */
    pre_build?: string[];
    /**
     * @default ["npm run build"]
     */
    build?: string[];
    /**
     * @default ["npx semantic-release"]
     */
    post_build?: string[];
  };
  /**
   * Run during each CodePipeline Action's install phase which
   * should not be confused with the pre_build phase
   * where dependencies should be installed
   * @default ["npm install -g npm@7", `aws codeartifact login --tool npm --domain ${codeArtifactDomain} --repository ${codeArtifactRepo} --namespace ${codeArtifactScope}`]
   */
  globalInstallCommands?: string[];
  /**
   * Run during each CodePipeline Action's pre_build phase where
   * dependencies should be installed
   * @default ["npm install"]
   */
  globalPreBuildCommands?: string[];
  name: string;
  repoDescription?: string;
  /**
   * @default "main"
   */
  releaseBranch?: string;
}

export class PkgPipeline extends Construct {
  constructor(scope: Construct, id: string, props: PkgPipelineProps) {
    super(scope, id);

    const {
      buildImage = LinuxBuildImage.STANDARD_5_0,
      codeArtifactDomain,
      codeArtifactRepo,
      codeArtifactNamespace,
      computeType = ComputeType.MEDIUM,
      globalInstallCommands = [
        "npm install -g npm@7",
        `aws codeartifact login --tool npm --domain ${codeArtifactDomain} --repository ${codeArtifactRepo} --namespace ${codeArtifactNamespace}`,
      ],
      globalPreBuildCommands = ["npm install"],
      name,
      repoDescription,
      releaseBranch = "main",
    } = props;
    if (!codeArtifactDomain || !codeArtifactRepo || !codeArtifactNamespace) {
      throw new Error(
        "codeArtifactDomain, codeArtifactRepo, and codeArtifactNamespace must be defined"
      );
    }
    const defaultBuildCommands = ["npm run build"];
    const defaultLintCommands = ["npm run lint"];
    const defaultReleaseCommands = ["npx semantic-release"];
    const defaultTestCommands = ["npm run test"];
    const {
      lintCommands = {
        install: globalInstallCommands,
        pre_build: globalPreBuildCommands,
        build: defaultLintCommands,
      },
      releaseCommands = {
        install: globalInstallCommands,
        pre_build: globalPreBuildCommands,
        build: defaultBuildCommands,
        post_build: defaultReleaseCommands,
      },
      testCommands = {
        install: globalInstallCommands,
        pre_build: globalPreBuildCommands,
        build: defaultTestCommands,
      },
    } = props;
    const commands = [lintCommands, releaseCommands, testCommands];
    for (const cmd of commands) {
      if (!cmd.install) cmd.install = globalInstallCommands;
      if (!cmd.pre_build) cmd.pre_build = globalPreBuildCommands;
    }
    if (!lintCommands.build) lintCommands.build = defaultLintCommands;
    if (!releaseCommands.build) releaseCommands.build = defaultBuildCommands;
    if (!releaseCommands.post_build)
      releaseCommands.post_build = defaultReleaseCommands;
    if (!testCommands.build) testCommands.build = defaultTestCommands;

    const repository = new Repository(this, "Repository", {
      repositoryName: name,
      description: repoDescription,
    });
    // typically this will be accessing a compiled js file
    // within node_modules but when we deploy this pipeline
    // for itself we need to access the TS file.
    let entry = resolve(__dirname, "commitFilterFn.js");
    const tsPath = resolve(__dirname, "commitFilterFn.ts");
    if (existsSync(tsPath)) entry = tsPath;
    const commitFilterFn = new NodejsFunction(this, "CommitFilterFn", {
      bundling: {
        sourceMap: true,
        minify: true,
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        REGION: Stack.of(this).region,
      },
      entry,
      initialPolicy: [
        new PolicyStatement({
          actions: ["codecommit:GetCommit"],
          resources: [repository.repositoryArn],
        }),
      ],
      logRetention: 1,
    });
    repository.onCommit("CommitToMain", {
      branches: ["main"],
      target: new LambdaFunction(commitFilterFn),
    });
    const pipeline = new Pipeline(this, "Pipeline", {
      pipelineName: name,
    });
    commitFilterFn.addEnvironment("PIPELINE_NAME", pipeline.pipelineName);
    commitFilterFn.addToRolePolicy(
      new PolicyStatement({
        actions: ["codepipeline:StartPipelineExecution"],
        resources: [pipeline.pipelineArn],
      })
    );
    // Source Stage
    const sourceOutput = new Artifact();
    const sourceAction = new CodeCommitSourceAction({
      actionName: "CodeCommit",
      branch: releaseBranch,
      repository,
      output: sourceOutput,
      codeBuildCloneOutput: true, // required for semantic-release in publish stage
      trigger: CodeCommitTrigger.NONE, // triggered by lambda
    });
    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    });
    // Lint Stage
    const lintProject = new PipelineProject(this, "LintPipelineProject", {
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: lintCommands.install,
          },
          pre_build: {
            commands: lintCommands.pre_build,
          },
          build: {
            commands: lintCommands.build,
          },
        },
      }),
      environment: {
        buildImage,
        computeType,
      },
    });
    this.addCodeArtifactGetAuthPolicies(
      lintProject,
      codeArtifactDomain,
      codeArtifactRepo
    );
    const lintAction = new CodeBuildAction({
      actionName: "Lint",
      project: lintProject,
      input: sourceOutput,
      type: CodeBuildActionType.TEST,
    });
    pipeline.addStage({
      stageName: "Lint",
      actions: [lintAction],
    });
    // Test Stage
    const testProject = new PipelineProject(this, "TestPipelineProject", {
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: testCommands.install,
          },
          pre_build: {
            commands: testCommands.pre_build,
          },
          build: {
            commands: testCommands.build,
          },
        },
      }),
      environment: {
        buildImage,
        computeType,
      },
    });
    this.addCodeArtifactGetAuthPolicies(
      testProject,
      codeArtifactDomain,
      codeArtifactRepo
    );
    const testAction = new CodeBuildAction({
      actionName: "Test",
      project: testProject,
      input: sourceOutput,
      type: CodeBuildActionType.TEST,
    });
    pipeline.addStage({
      stageName: "Test",
      actions: [testAction],
    });
    // Publish Stage
    const publishProject = new PipelineProject(this, "PublishPipelineProject", {
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        env: {
          "git-credential-helper": "yes", // to run git commands
        },
        phases: {
          install: {
            commands: releaseCommands.install,
          },
          pre_build: {
            commands: releaseCommands.pre_build,
          },
          build: {
            commands: releaseCommands.build,
          },
          post_build: {
            commands: releaseCommands.post_build,
          },
        },
      }),
      environment: {
        buildImage,
        computeType,
      },
    });
    this.addCodeArtifactGetAuthPolicies(
      publishProject,
      codeArtifactDomain,
      codeArtifactRepo
    );
    publishProject.addToRolePolicy(
      new PolicyStatement({
        actions: ["codeartifact:PublishPackageVersion"],
        resources: [
          Arn.format(
            {
              // cannot specify scope/namespace for package in permissions because IAM doesn't
              // allow @ signs in permissions so get permission denied
              // resource: `package/${codeArtifactDomain}/${codeArtifactRepo}/npm/${codeArtifactScope}/*`,
              resource: `package/${codeArtifactDomain}/${codeArtifactRepo}/npm/*`,
              service: "codeartifact",
            },
            Stack.of(this)
          ),
        ],
      })
    );
    publishProject.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "codecommit:GitPull",
          "codecommit:GetReferences",
          "codecommit:GitPush",
          "codecommit:TagResource",
        ],
        resources: [repository.repositoryArn],
      })
    );
    const publishAction = new CodeBuildAction({
      actionName: "Publish",
      project: publishProject,
      input: sourceOutput, // semantic-release command must be executed from a Git repository
    });
    pipeline.addStage({
      stageName: "Publish",
      actions: [publishAction],
    });
    // output for dev convenience
    new CfnOutput(this, "PipelineNameOutput", {
      value: pipeline.pipelineName,
    });
  }

  addCodeArtifactGetAuthPolicies(
    project: PipelineProject,
    codeArtifactDomain: string,
    codeArtifactRepo: string
  ): void {
    project.addToRolePolicy(
      new PolicyStatement({
        actions: ["sts:GetServiceBearerToken"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "sts:AWSServiceName": "codeartifact.amazonaws.com",
          },
        },
      })
    );
    project.addToRolePolicy(
      new PolicyStatement({
        actions: ["codeartifact:GetAuthorizationToken"],
        resources: [
          Arn.format(
            {
              resource: `domain/${codeArtifactDomain}`,
              service: "codeartifact",
            },
            Stack.of(this)
          ),
        ],
      })
    );
    project.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "codeartifact:GetRepositoryEndpoint",
          "codeartifact:ReadFromRepository",
        ],
        resources: [
          Arn.format(
            {
              resource: `repository/${codeArtifactDomain}/${codeArtifactRepo}`,
              service: "codeartifact",
            },
            Stack.of(this)
          ),
        ],
      })
    );
  }
}
