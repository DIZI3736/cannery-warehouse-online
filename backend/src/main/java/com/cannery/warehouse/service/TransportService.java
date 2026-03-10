package com.cannery.warehouse.service;

import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class TransportService {

    /**
     * Упрощенное решение транспортной задачи методом северо-западного угла.
     * @param supply запасы на складах (массив)
     * @param demand потребности магазинов (массив)
     * @return матрица распределения
     */
    public int[][] solve(int[] supply, int[] demand) {
        int[][] result = new int[supply.length][demand.length];
        int s = 0, d = 0;
        
        int[] tempSupply = supply.clone();
        int[] tempDemand = demand.clone();

        while (s < tempSupply.length && d < tempDemand.length) {
            int quantity = Math.min(tempSupply[s], tempDemand[d]);
            result[s][d] = quantity;
            tempSupply[s] -= quantity;
            tempDemand[d] -= quantity;

            if (tempSupply[s] == 0) s++;
            else d++;
        }
        return result;
    }
}
