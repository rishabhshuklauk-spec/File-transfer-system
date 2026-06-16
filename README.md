# Itransfer! 

A cool website that transfers files safely and securely. I got the name from wetransfer but instead its me so... Itransfer.   
**URL:** itransfer.pages.dev 


## Key Features

* **Zero-Knowledge Architecture:** Files are fully encrypted directly inside the client's browser using the native Web Crypto API (256-bit AES-GCM). The server never sees the raw file, the original filename, or the encryption keys so that nothing you send can be seen by the server and therfore making is secure.
* **File durations:** Choose exactly how long your file survives:
  * Self-Destruct (1 Download): The file is permanently wiped from the database and storage the split second it is downloaded once.
  * Multi-Download (5 or 10): A Redis-backed counter tracks downloads and triggers an atomic purge when the limit is hit.
  * Time-to-Live (24 Hours) Unlimited downloads for 1 day, managed by automated Redis TTL expirations.
* **Cross-Platform Safe Links:** The encryption key and metadata are stored safely inside standard URL parameters within the hash fragment #key=  &name= ensuring that messaging apps like whatsapp don't mangle the decryption keys.
* **Cloudflare:** The backend runs on Cloudflare Workers, meaning its fast.


## Technical Stack

* **Frontend:** HTML5 / CSS3 / Vanilla JS hosted using cloudflare pages.
* **Backend Engine:** Hono mixed in with cloudflare workers (It's free!)
* **Database / State:** Upstash Redis (Managing time and download counters)
* **Object Storage:**  Backblaze B2 (S3-compatible, 10GB and doesn't require any card details)

