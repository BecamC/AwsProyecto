# Sistema de Gestión de Pedidos para Pardo (Core)

Este repositorio contiene la implementación serverless descrita en el plan adjunto.
Incluye los microservicios de Productos, Pedidos e Inventario alojados en AWS Lambda,
con comunicación mediante API Gateway REST, EventBridge, SQS, SNS y Step Functions.

## Estructura principal

- `serverless.yml`: Infraestructura (tablas DynamoDB, Step Functions, SNS, SQS y Lambdas).
- `handlers/`: Código de los microservicios (productos, pedidos, inventario y workflow).
- `shared/`: Utilidades comunes (DynamoDB, validaciones, SNS, EventBridge, etc.).
- `package.json`: Dependencias (AWS SDK v3 y Serverless Framework).

## Uso

```bash
cd AwsProyecto
npm install
npx serverless deploy --stage dev
```

> El microservicio de usuarios, validación de seguridad y WebSocket se implementan por fuera de este repositorio según el plan acordado.