#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from "../lib/stacks" 

const app = new cdk.App();
new BackendStack(app, 'BackendStack', {
});