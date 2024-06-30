import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props {
    scope: Construct;
    name: string;
    functions: {
        name: string;
        function: cdk.aws_lambda.Function;
    } [];
}

export function newMiddlewareGatewayAPI(props: Props): { 
    integration: cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration;
    api: cdk.aws_apigatewayv2.HttpApi;
    } {
    
    // This should be automated eventually.
    const integrationSendMessageLambda = new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "idHttpLambdaIntegration".concat(props.functions[0].name), props.functions[0].function);
    
    const integrationGetChannelLambda = new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "idHttpLambdaIntegration".concat(props.functions[1].name), props.functions[1].function);

    const newAPI = new cdk.aws_apigatewayv2.HttpApi(props.scope, "idHttpApi".concat(props.name));
    //Also should be automated.
    newAPI.addRoutes({
        path: "/sendMessage",
        methods: [cdk.aws_apigatewayv2.HttpMethod.POST],
        integration: integrationSendMessageLambda,
    });
    newAPI.addRoutes({
            path: "/getChannel",
            methods: [cdk.aws_apigatewayv2.HttpMethod.POST],
            integration: integrationGetChannelLambda,
    });

    return {
        integration: integrationSendMessageLambda,
        api: newAPI,
    };
}