package com.cannery.warehouse.controller;

import com.cannery.warehouse.service.TransportService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/transport")
@CrossOrigin(origins = "*")
public class TransportController {

    private final TransportService transportService;

    public TransportController(TransportService transportService) {
        this.transportService = transportService;
    }

    @PostMapping("/solve")
    public int[][] solve(@RequestBody Map<String, int[]> request) {
        int[] supply = request.get("supply");
        int[] demand = request.get("demand");
        return transportService.solve(supply, demand);
    }
}
