package com.cannery.warehouse.dto;

public class CategoryStatDTO {
    private String name;
    private Integer percent;

    public CategoryStatDTO() {}

    public CategoryStatDTO(String name, Integer percent) {
        this.name = name;
        this.percent = percent;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getPercent() {
        return percent;
    }

    public void setPercent(Integer percent) {
        this.percent = percent;
    }
}
