/* eslint-env jest */

/**
 * @copyright 2018–2023 Cimpress plc
 * @license Apache-2.0
 */

import {createPolicyDocument as sut} from ".";

const allEndpoints = "arn:aws:execute-api:region:account-id:api-id/stage-name/*";

describe(
    "a resource path converts",
    () => {

        test(
            "from the example",
            () => {

                const {"Statement": [{"Resource": actual}]} =
                    sut("arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource-path");
                expect(actual).toBe(allEndpoints);

            }
        );

        test(
            "which is nested",
            () => {

                const {"Statement": [{"Resource": actual}]} =
                    sut("arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource/path");
                expect(actual).toBe(allEndpoints);

            }
        );

    }
);

test(
    "a route key converts",
    () => {

        const {"Statement": [{"Resource": actual}]} =
            sut("arn:aws:execute-api:region:account-id:api-id/stage-name/route-key");
        expect(actual).toBe(allEndpoints);

    }
);
