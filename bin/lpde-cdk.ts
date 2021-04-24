#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LpdeCdkStack } from '../lib/lpde-cdk-stack';
import { Tags } from '@aws-cdk/core';

const app = new cdk.App();
const lpdeCdkStack = new LpdeCdkStack(app, 'LpdeCdkStack');
Tags.of(lpdeCdkStack).add('activity', 'presales');
Tags.of(lpdeCdkStack).add('customer', 'Innominata');
