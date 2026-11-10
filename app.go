package main

import (
	"context"
	"devboard/store"
	"fmt"
)

// App struct
type App struct {
	ctx  context.Context
	conn *store.Store
}

type Board struct {
	Projects []store.Project `json:"projects"`
	Items    []store.Item    `json:"items"`
}

// NewApp creates a new App application struct
func NewApp(conn *store.Store) *App {
	return &App{conn: conn}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) LoadBoard() (Board, error) {
	var board Board

	projects, err := a.conn.ListProjects()
	if err != nil {
		return Board{}, fmt.Errorf("load board list-projects: %w", err)
	}
	board.Projects = projects

	for _, p := range projects {
		items, err := a.conn.ListItems(p.Id)
		if err != nil {
			return Board{}, fmt.Errorf("load board list-items: %w", err)
		}
		board.Items = append(board.Items, items...)
	}

	return board, nil
}

func (a *App) UpsertProject(p store.Project) error {
	return a.conn.UpsertProject(p)
}

func (a *App) UpsertItem(i store.Item) error {
	return a.conn.UpsertItem(i)
}

func (a *App) DeleteItem(project_id string, item_id string) (int64, error) {
	return a.conn.DeleteItem(project_id, item_id)
}

func (a *App) DeleteProject(project_id string) (int64, error) {
	return a.conn.DeleteProject(project_id)
}
