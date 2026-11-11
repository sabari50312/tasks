package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type Store struct {
	db *sql.DB
}

const stampLayout = "2006-01-02T15:04:05.000Z07:00"

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=foreign_keys(1)")
	if err != nil {
		return nil, fmt.Errorf("Error while opening db connection: %w", err)
	}
	db.SetMaxOpenConns(1)

	_, err = db.Exec(schema)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("Error while running schema setup: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

// Insert/Update Project
func (s *Store) UpsertProject(proj Project) error {
	proj.Id = strings.TrimSpace(proj.Id)
	proj.Name = strings.TrimSpace(proj.Name)
	if proj.Name == "" || proj.Id == "" {
		return fmt.Errorf("Cannot create project with empty name or id")
	}
	_, err := s.db.Exec(`INSERT INTO projects (id, name)
   VALUES (?, ?)
   ON CONFLICT (id) DO UPDATE
   SET name=excluded.name`, proj.Id, proj.Name)

	if err != nil {
		return fmt.Errorf("upsert project %s: %w", proj.Id, err)
	}

	return nil
}

// Insert/Update Item
func (s *Store) UpsertItem(item Item) error {
	item.Title = strings.TrimSpace(item.Title)
	item.Id = strings.TrimSpace(item.Id)
	if item.Title == "" || item.Id == "" {
		return fmt.Errorf("Cannot create task with empty title or id")
	}

	now := time.Now().UTC().Format(stampLayout)

	_, err := s.db.Exec(`INSERT INTO items (id, project_id, type, title, description, status, priority, due_date, created_at, updated_at, item_order) 
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT (id) DO UPDATE SET
		type = excluded.type,
		project_id= excluded.project_id,
		title = excluded.title,
		description = excluded.description,
		status = excluded.status,
		priority = excluded.priority,
		due_date = excluded.due_date,
		updated_at = excluded.updated_at`,
		item.Id, item.ProjectID, item.Type, item.Title, item.Description, item.Status, item.Priority, item.DueDate, now, now, item.ItemOrder)

	if err != nil {
		return fmt.Errorf("item upsert error: %w", err)
	}
	return nil
}

func (s *Store) UpdateItemOrder(item_id string, order float64) error {
	if _, err := s.db.Exec(`UPDATE items SET item_order=?
	WHERE id=?`, order, item_id); err != nil {
		return fmt.Errorf("update order error: %w", err)
	}
	return nil
}

// List all projects
func (s *Store) ListProjects() ([]Project, error) {
	projects := []Project{}

	rows, err := s.db.Query(`SELECT * FROM projects ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("list projects query error: %w", err)
	}

	defer rows.Close()
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.Id, &p.Name); err != nil {
			return nil, fmt.Errorf("scan project error: %w", err)
		}
		projects = append(projects, p)
	}

	if rows.Err() != nil {
		return nil, fmt.Errorf("project rows error: %w", rows.Err())
	}

	return projects, nil
}

// List all items of a project
func (s *Store) ListItems(project_id string) ([]Item, error) {
	items := []Item{}
	rows, err := s.db.Query(`SELECT id, 
	project_id,
	type, 
	title, 
	description, 
	status, 
	priority, 
	due_date, 
	created_at, 
	updated_at,
	item_order 
	FROM items WHERE project_id=?
	ORDER BY item_order, created_at`, project_id)
	if err != nil {
		return nil, fmt.Errorf("list items query error: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var i Item
		if err := rows.Scan(&i.Id,
			&i.ProjectID,
			&i.Type,
			&i.Title,
			&i.Description,
			&i.Status,
			&i.Priority,
			&i.DueDate,
			&i.CreatedAt,
			&i.UpdatedAt,
			&i.ItemOrder); err != nil {
			return nil, fmt.Errorf("scan items error: %w", err)
		}
		items = append(items, i)
	}

	if rows.Err() != nil {
		return nil, fmt.Errorf("items row error: %w", rows.Err())
	}
	return items, nil
}

// delete project
func (s *Store) DeleteProject(project_id string) (int64, error) {
	res, err := s.db.Exec(`DELETE FROM projects where id=?`, project_id)
	if err != nil {
		return 0, fmt.Errorf("delete project error: %w", err)
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}

	if rows == 0 {
		return 0, fmt.Errorf("no rows deleted. (no rows found to delete)")
	}

	return rows, nil
}

// delete item in project
func (s *Store) DeleteItem(project_id string, item_id string) (int64, error) {
	res, err := s.db.Exec(`DELETE FROM items where project_id=? and id=?`, project_id, item_id)
	if err != nil {
		return 0, fmt.Errorf("delete item error: %w", err)
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	if rows == 0 {
		return 0, fmt.Errorf("no rows deleted. (no rows found to delete)")
	}

	return rows, nil
}
