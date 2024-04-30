### Background

"Amazon RDS Certificate Authority certificates rds-ca-2019 are set to expire in August, 2024. If you use or plan to use Secure Sockets Layer (SSL) or Transport Layer Security (TLS) with certificate verification to connect to your RDS DB instances or Multi-AZ DB clusters, consider using one of the new CA certificates rds-ca-rsa2048-g1, rds-ca-rsa4096-g1 or rds-ca-ecc384-g1."

For more information please see: 
* https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL-certificate-rotation.html
* https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html

### CA Bundle

The `rds-global-bundle.pem` is a certificate bundle for all AWS Regions. It contains both the rds-ca-2019 intermediate and root certificates. The bundle also contains the rds-ca-rsa2048-g1, rds-ca-rsa4096-g1, and rds-ca-ecc384-g1 root CA certificates. Your application trust store only needs to register the root CA certificate.

Please visit: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html#UsingWithRDS.SSL.CertificatesAllRegions for more information about the AWS RDS CA bundle included here as `rds-global-bundle.pem`. NB: the bundle was renamed `global-bundle.pem` > `rds-global-bundle.pem`.

### Usage

Heroku provides usage instructions for connecting (Ruby app) to AWS' RDS (MySQL), see here https://devcenter.heroku.com/articles/amazon-rds. This approach should also be valid for connecting Node apps.

In short, the `env` vars that provide connection string/s to the RDS (MySQL) instance need to contain an extra `sslca` parameter ie. `sslca=config/rds-global-bundle.pem`.

By the same token, the `env` vars that provide connection string/s to the RDS (Postgres) instance need to contain an extra `sslrootcert` parameter ie. `sslrootcert=config/rds-global-bundle.pem`.
