# Multi-site

One central GLT can monitor several Home Assistant sites and send authorised
control commands to them.

**The value of such a view is that somebody stops watching five screens.** The
moment they do, a site missing unnoticed is a plant nobody is watching. That is
why the most important rule of this page is not what the view can do, but what
it says when it cannot.

## A partial answer says that it is partial

An evaluation names **which sites answered, which did not, and why**. Every
total carries its own completeness, and a total without that statement is not
displayed but refused.

The temptation is to treat a partial result as an error — errors are simpler.
That is wrong in **both** directions:

- Failing the whole evaluation because one site is down makes four healthy
  plants invisible. That is worse than the missing one.
- Returning the four and calling it "the portfolio" is exactly the mistake.

A silent site contributes **nothing** to the total — it does not contribute
zero. That is precisely how a number comes out smaller and confident.

## "Unreachable" is not an entity state

Previously a failed read wrote:

```python
result[entity_id] = {"state": "unavailable", "error": resp.status}
```

`unavailable` is a **real** Home Assistant state. An entity genuinely
unavailable at the remote site and one we could not ask produced the same
word.

Unreachability belongs to the **site**. An entity we could not ask simply has
no measurement — inventing one is the error.

### Four site states

| State | Meaning |
|---|---|
| `healthy` | answered, within the time budget |
| `slow` | answered, above the time budget |
| `unreachable` | was asked and did not answer |
| `circuit_open` | was **not asked**, because it had failed repeatedly |

The last two are the pair that matters. A suspended site has been broken for a
while; an unreachable one broke just now. Displaying both the same hides how
long the problem has existed — and that is the difference between "check the
network" and "the plant has been down since Tuesday".

`slow` is an **answer**. Treating it as an outage would throw away real data.

## One read per site, not per entity

Previously each entity was asked individually, with a 15-second timeout per
request: two hundred entities against a non-answering site are **fifty
minutes** inside a websocket handler. That is not only slow, it is an
availability fault — and the obvious remedies (shorter timeout, fewer
entities) make the answer *more incomplete* instead of faster.

`GET /api/states` delivers all states in one request. Filtering happens at the
Companion, because over a slow link the roundtrips *are* the cost.

Three limits, and they answer three different questions:

| Limit | Question |
|---|---|
| Concurrency | how many sites are asked at once |
| Timeout per site | how long one site may take |
| **Overall deadline** | how long the *request* may take |

The third is usually missing and is the decisive one: bounded concurrency
alone still lets *n* sites times timeout run together. The deadline belongs to
the request and is not divided among the sites — whoever waits on one screen
has a time budget that does not depend on how many sites a colleague
configured.

A truncated entity list **says that it was truncated**.

## Where the Companion may connect

Previously **any** URL was accepted: no scheme check, no host check, no
allowlist — and the Companion then made an **authenticated** request there and
returned the response to the browser. That is a server-side request forgery
tool with credentials attached, reachable through a configuration field.

The check has **two halves**, and neither carries alone:

1. **A server-side allowlist.** A target is site configuration, never project
   data — the same rule as the notification targets and the simulation lock,
   and the third occurrence makes it the product's security model rather than
   a precaution.
2. **A check of the resolved address at connect time.** An allowed name can
   resolve publicly during the check and to `127.0.0.1` at connect — that is
   DNS rebinding, and it defeats a list that only looks at the name.

Loopback, link-local, private and unique-local ranges are refused.
**169.254.169.254** is checked by name: that is the cloud metadata endpoint,
and an SSRF reaching it yields credentials for the whole account.

A disabled certificate check must be **explicitly justified** and then appears
next to every number that site delivers.

## Credentials never leave the Companion

No token appears in a response, a log line, an export or an error message.
That is **searched for**, not asserted: a sentinel token is sent through every
path, including every error branch, and looked for in all outputs afterwards.

The subtler half concerns **error texts**. Connection errors carry the host
and port they could not reach — returning `str(err)` therefore let a caller
enumerate internal names by provoking failures. Errors are hence a closed set
of reasons; the exception is logged server-side.

## Remote is not a second product

Every rule of the local path applies unchanged one network hop further: the
same capabilities, the same project assignment, the same four control
outcomes, the same audit, the same simulation lock.

A site belongs to projects, and that binding is server configuration. Whoever
is authorised for project A does not operate site B.

The site list is **filtered and then limited**. The other way round, the limit
becomes a counting oracle for rows the caller may not see.

### A timeout is not a failure

The difference between "we do not know whether it happened" and "it did not
happen" is **more** important over a network, not less: a timeout on a `POST`
is the classic case where the service may well have run.

It is therefore reported as `effect_unknown`, and **next to an unknown effect
no retry is offered**. Remedying is a new, separately authorised command —
otherwise the plant is operated twice.

## What does not exist

- **No remote engineering.** Read states, read history, send authorised
  control commands. Editing a remote site's project is not part of it.
- **No cross-site alarm correlation.** Phase 6 owns alarms; this phase carries
  site identity into them instead of building a second model.
- **No measured capacity numbers.** Phase 10 owns budgets. This phase makes
  the *shape* of the cost boundable and names its limits; the measured numbers
  come later.
- **No redesign of credential storage.** Tokens stay in the Companion
  configuration.
