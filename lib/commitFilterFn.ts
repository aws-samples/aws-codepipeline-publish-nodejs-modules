// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { EventBridgeEvent } from "aws-lambda";
import { CodeCommitClient, GetCommitCommand } from "@aws-sdk/client-codecommit";
import {
  CodePipelineClient,
  StartPipelineExecutionCommand,
} from "@aws-sdk/client-codepipeline";

const ccClient = new CodeCommitClient({
  region: process.env.REGION || process.env.AWS_REGION,
});
const cpClient = new CodePipelineClient({
  region: process.env.REGION || process.env.AWS_REGION,
});

// https://docs.aws.amazon.com/codecommit/latest/userguide/monitoring-events.html#referenceCreated
interface CodeCommitReferenceCreated {
  repositoryName: string;
  commitId: string;
  // other fields but they don't pertain to this fn
}

export async function handler(
  event: EventBridgeEvent<
    "CodeCommitReferenceCreated",
    CodeCommitReferenceCreated
  >
): Promise<void> {
  console.log(JSON.stringify(event));
  const pipelineName = process.env.PIPELINE_NAME;
  if (!pipelineName) throw new Error("process.env.PIPELINE_NAME is undefined");
  const { repositoryName, commitId } = event.detail;
  const { commit } = await ccClient.send(
    new GetCommitCommand({ repositoryName, commitId })
  );
  if (!commit?.message?.includes("[skip ci]")) {
    console.log("triggering pipeline");
    const res = await cpClient.send(
      new StartPipelineExecutionCommand({ name: pipelineName })
    );
    console.log(res);
  } else {
    console.log("not triggering pipeline due to [skip ci] in commit message");
  }
}
