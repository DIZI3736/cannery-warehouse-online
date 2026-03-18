package com.cannery.warehouse.service;

import org.springframework.stereotype.Service;

@Service
public class TransportService {

    /**
     * Solves a balanced transport problem by the north-west corner method.
     */
    public int[][] solve(int[] supply, int[] demand) {
        int[][] result = new int[supply.length][demand.length];
        int s = 0;
        int d = 0;

        int[] tempSupply = supply.clone();
        int[] tempDemand = demand.clone();

        while (s < tempSupply.length && d < tempDemand.length) {
            int quantity = Math.min(tempSupply[s], tempDemand[d]);
            result[s][d] = quantity;
            tempSupply[s] -= quantity;
            tempDemand[d] -= quantity;

            if (tempSupply[s] == 0) {
                s++;
            } else {
                d++;
            }
        }

        return result;
    }
}
