package store

import "time"

type Project struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type Item struct {
	ProjectID   string    `json:"projectId"`
	Id          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Type        string    `json:"type"`
	Status      string    `json:"status"`
	Priority    string    `json:"priority"`
	DueDate     string    `json:"due"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	ItemOrder   float64   `json:"itemOrder"`
}

// Status, Priority, DueDate, CreatedAt, UpdatedAt, and Tags.
