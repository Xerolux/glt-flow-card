# User permissions & audit log

Roles: `viewer`, `operator`, `designer`. Home Assistant administrators automatically count as designers.

```yaml
permissions:
  designers:
    - USER_ID_1
  operators:
    - USER_ID_2
  viewers:
    - USER_ID_3
  confirm_controls: true
```

The audit log records project actions, YAML import/export, operations, acknowledgements and report creation. With the Companion backend, user id and display name are added server-side.
