import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface props {
    scope: Construct;
    name: string;
    function: cdk.aws_lambda.Function;
}

export function newMiddlewareGatewayAPI(props: props): { 
    integration: cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration;
    api: cdk.aws_apigatewayv2.HttpApi;
} {
    const integrationSendMessageLambda = new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "idHttpLambdaIntegration".concat(props.name), 
        props.function);
    
    const newAPI = new cdk.aws_apigatewayv2.HttpApi(props.scope, "idHttpApi".concat(props.name));
    newAPI.addRoutes({
        path: "/sendMessage",
        methods: [cdk.aws_apigatewayv2.HttpMethod.POST],
        integration: integrationSendMessageLambda,
    });

    return {
        integration: integrationSendMessageLambda,
        api: newAPI,
    };
}