# FAQ

## Is adding the repository and installing enough?
For the card and integrated designer, install through HACS as **Dashboard**
and reload the browser. Shared projects, enforced operations and Recorder
trends also require installing and configuring the Companion in **Devices &
services**. Keep exactly one GLT JavaScript resource, assign your entities and
save the card. See [Installation](Installation).

## Is the online designer connected to Home Assistant?
No. It stores drafts in the browser, previews demonstration values and exports
YAML. Live data and Companion functions become available in Home Assistant.
The HA designer is included in the card installation.

## Do I need my own images?
No. The entire plant can be built from the integrated symbol library.

## Do I have to write YAML?
No. The HA designer can produce the complete configuration. YAML remains available for import, fine-tuning and version control.

## Can I keep editing existing YAML?
Yes. YAML import opens the configuration in the designer; afterwards you can export YAML again.

## Where are projects stored?
By default in the browser. With the optional Companion backend, directly in Home Assistant.

## Is the card a replacement for Desigo/EcoStruxure?
As an HA visualisation and engineering front end it covers many typical functions. Fieldbus, redundancy, certification and enterprise backend capabilities of large commercial GLT suites remain the job of Home Assistant and the respective automation infrastructure.
