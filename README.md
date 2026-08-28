# ikomida-microservice-vendors

Vendor configuration, storefront layout and staff.

> Part of the **iKomida** platform. See **[ikomida-k8s-config](https://github.com/kaitbellahs/ikomida-k8s-config)** for the architecture overview of all 31 repositories.

---

## Role

Everything a vendor controls about their own presence: business hours, delivery rules, the visual layout of their storefront, their staff members and permissions, their plan limits, and which payment gateway their money flows through.

The layout endpoint is public by design — it is what an anonymous visitor loads to render a storefront.

## Endpoints

As declared in the [gateway route table](https://github.com/kaitbellahs/ikomida-microservice-gateway/blob/dev/src/routes.ts) (15 routes reach this service):

| Method | Path | Roles |
|---|---|---|
| `GET` | `/vendor/app` | VENDOR, ADMIN |
| `PATCH` | `/vendor/app` | VENDOR, ADMIN |
| `PUT` | `/vendor/businessHours` | VENDOR, STAFF, ADMIN |
| `GET` | `/vendor/pagSeguroUrl` | VENDOR, ADMIN |
| `PUT` | `/vendor/delivery` | VENDOR, STAFF, ADMIN |
| `PUT` | `/vendor/updatePaymentGateway` | VENDOR, ADMIN |
| `DELETE` | `/vendor/revokePaymentGateway` | VENDOR, ADMIN |
| `GET` | `/vendor/settings` | VENDOR, STAFF, ADMIN |
| `GET` | `/vendor/limits` | VENDOR, STAFF, ADMIN |
| `GET` | `/vendor/staff/:timestamp` | VENDOR, ADMIN |
| `POST` | `/vendor/staff` | VENDOR, ADMIN |
| `DELETE` | `/vendor/staff/:id` | VENDOR, ADMIN |
| `GET` | `/layout` | *public* |
| `PUT` | `/layout` | VENDOR, STAFF, ADMIN |
| `PUT` | `/vendor/settings` | VENDOR, STAFF, ADMIN |

## Stack

TypeScript (ESM) · Express · Sequelize · rollup · Docker · Kubernetes

Depends on [`@ikomida/shared-types`](https://github.com/kaitbellahs/ikomida-shared-types), [`@ikomida/shared-backend`](https://github.com/kaitbellahs/ikomida-shared-backend) and [`@ikomida/shared-logics`](https://github.com/kaitbellahs/ikomida-shared-logics).

## Build

```bash
yarn install
yarn build      # rollup bundle
yarn service    # run locally
```

## Status

Built in 2022. The platform is no longer deployed; this repository is published as a record of the work. **The commit history predates generative AI coding assistants.**

## License

Licensed under the [Apache License 2.0](LICENSE) — free for commercial use, provided the copyright notice and [NOTICE](NOTICE) are retained.

Copyright 2022 Khalid Ait Bellahs.
