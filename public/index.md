# ids.pub: a home for your public keys

Every key you use, at one address. Put keys in groups, and each group has an address of its own with only those keys.

- Update your keys in one place. Servers that read your address at each login stop accepting a key as soon as you remove it.
- Give each server only the keys it needs. A server that reads a group's address accepts the keys in that group and no others.
- Use the same keys beyond logins. Git checks your signed commits against your address, and age encrypts files to the keys at it.

An example: `https://ids.pub/alice` has all of Alice's keys; `https://ids.pub/alice/prod` has only those in her prod group.

Get started at https://ids.pub, signing in with GitHub. How addresses answer: https://ids.pub/llms.txt
