# Benutzerrechte & Audit-Log

Rollen: `viewer`, `operator`, `designer`. Home-Assistant-Administratoren gelten automatisch als Designer.

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

Das Audit-Log protokolliert Projektaktionen, YAML-Import/Export, Bedienungen, Quittierungen und Report-Erstellung. Mit Companion-Backend werden Benutzer-ID und Anzeigename serverseitig ergänzt.
