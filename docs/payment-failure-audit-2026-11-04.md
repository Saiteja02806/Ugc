# Payment failure audit — 4 November 2026

Read-only checks; no checkout created, payment attempted, provider settings changed, application source edited, build or deployment.

## Production request evidence

Vercel website project prj_mVOxt7AUko5egMAESaxjGyC60Kvu queried last24hours for/api/billing/checkout. Returned6serverless records:3HTTP500on previous deployment dpl_89uyJaRSFsUgXKFCGQYtqYMVZrfj at3November18:26:12–50UTC(23:56IST),all explicitly caused by conflicting DODO_STARTUP_PLAN_MONTHLY and DODO_GROWTH_MONTHLY_PRODUCT_ID. The newer deployment dpl_5V82CG82ghtbajsB26nQcuiAjD6W has2HTTP401records and1HTTP200 at4November12:21:52UTC(17:51IST).401is authentication rejection,not evidence of a declined charge.200means checkout endpoint response,not successful payment or independently verified destination. No newer500appeared in this returned sample; finite retained logs do not prove no other failure.

## Provider/config readback

Existing local environment is live_mode and API/webhook credentials present. Exact application variable names were used, including Startup's DODO_STARTUP_PLAN_MONTHLY/YEARLY exception. Six distinct configured products retrieved successfully from live Dodo viaGET:StarterUSD29monthly/299yearly,Growth49monthly/490yearly,Startup99monthly/999yearly. No duplicate ID among these configured products. These are local env+provider readbacks,not an inspection of hidden current hosted variables. Initial diagnostic mistakenly looked for standard Startup PRODUCT_ID naming; corrected before reporting a missing-config conclusion. No config changed.

Configured Dodo live account payments.list with last30days creation filter returned0payments and no APIerror. This does not rule out checkout-before-payment failures,earlier transactions,anothermerchantaccount or webhookdelivery failures. No fresh card/bank/3DS failure cause was observed.

## Connected database evidence

billing_subscriptions statuses:6active(latestSeptember9),2failed(latestAugust27),1on_hold(latestSeptember30). Historical subscription.failed webhook datesAugust26/August27;payment.failedSeptember30followed~15seconds later bysubscription.on_hold. Subscription events processed;payment.failed was intentionally ignored for entitlement mutation because subscription events govern access. The queried failure-reason/error-code/error-message payloadfields are null,so exact bank/provider decline reason is UNKNOWN. These stored events are not newly triggered payments or proof the current provider credential covers every historical event.

27billing_webhook_events:22processed,5ignored,0other/unprocessed/failed statuses. Most recentstored eventNovember2isignoredrefund.succeeded whose payloadtimestampisAugust2025; cannot call it a new customer refund or a failed webhook. No stuck/failed persisted webhook processing found; never-received webhook deliveries cannot be excluded from database alone.

## Code checks

44focused checkout/account/provider/activation/pending/recovery tests:43PASS,1FAIL. Failure lib/billing/dodo-billing-recovery.test.mjs:56 expects2free credits for held/failed/paused subscribers,but current subscription-db explicitly zeros spendable free credits while retainingused/reserved balances. Thus failure is a fixture/policy mismatch,not proof of a real declinedpayment; failingassertion occursbeforeportalcall,so this testdoesnotverifyportalrecovery currently. Do not silently restorecreditsorweakenassertionsduringaudit. Other tests cover managedcheckoutguard,accountreadfailures,productconflict refusal,signedwebhookconfiguration,activation/pendingcookies. No build needed orrun.

Raw sanitized readbacks:.tmp/payment-readonly-audit-20261104.json;productionlogs:.tmp/payment-vercel-logs-20261104.jsonl;tests:.tmp/payment-audit-tests.log. Secrets never printed. No customer emails/carddetails included. Read-onlySupabaseschema/statusqueriesandexistingDodoSDKmethodsinspected. RootAGENTS/billingincidenthistory/currentcheckout,portal,webhook,provider/subscriptioncode reviewed. Largehistoricalledgers notfreshlyrereadinfull; noapplicationedits.

Conclusion: confirmed historical checkoutconfigfailure,oldfailed/heldsubscriptionrecords,onefailinglocalbillingtest. Currentconfiguredproductsreadcorrectly,andnewercheckoutHTTP200exists. Actualcompletedpayment,freshlivecheckoutbrowserhandoff,bankdeclinehandlingandpayment-to-creditactivationareNOTVERIFIED. Noall-clearclaim.
