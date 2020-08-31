#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LpdeCdkStack } from '../lib/lpde-cdk-stack';

const app = new cdk.App();
new LpdeCdkStack(app, 'LpdeCdkStack');
