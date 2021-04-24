#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LpdeCdkStack } from '../lib/lpde-cdk-stack';
import { Tags } from '@aws-cdk/core';

const app = new cdk.App();
const innominataDemo = new LpdeCdkStack(app, 'InnominataDemo');

Tags.of(innominataDemo).add('Activity', 'presales');
Tags.of(innominataDemo).add('Customer', 'innominata');
Tags.of(innominataDemo).add('Project', 'innominata');
Tags.of(innominataDemo).add('Author', 'Andrea Bisognin');