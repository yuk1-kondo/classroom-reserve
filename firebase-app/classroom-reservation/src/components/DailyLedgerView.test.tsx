import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DailyLedgerView } from './DailyLedgerView';
import { authService } from '../firebase/auth';
import { roomsService } from '../firebase/firestore';
import { MonthlyReservationsProvider } from '../contexts/MonthlyReservationsContext';

// Mock Firebase config first
jest.mock('../firebase/config', () => ({
  db: {},
  auth: {},
  app: {},
}));

// Mock the firebase modules
jest.mock('../firebase/auth');
jest.mock('../firebase/firestore');
jest.mock('../contexts/MonthlyReservationsContext', () => ({
  useMonthlyReservations: () => ({
    reservations: [],
    setRange: jest.fn(),
    refetch: jest.fn(),
  }),
  MonthlyReservationsProvider: ({ children }: any) => <div>{children}</div>,
}));

describe('DailyLedgerView', () => {
  const mockGetAllRooms = roomsService.getAllRooms as jest.MockedFunction<typeof roomsService.getAllRooms>;
  const mockGetCurrentUser = authService.getCurrentUser as jest.MockedFunction<typeof authService.getCurrentUser>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllRooms.mockResolvedValue([]);
    mockGetCurrentUser.mockReturnValue(null);
  });

  test('renders checkbox for filtering own reservations', () => {
    render(
      <DailyLedgerView
        date="2025-01-01"
        filterMine={false}
        onFilterMineChange={jest.fn()}
        onDateChange={jest.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  test('checkbox is checked when filterMine is true', () => {
    render(
      <DailyLedgerView
        date="2025-01-01"
        filterMine={true}
        onFilterMineChange={jest.fn()}
        onDateChange={jest.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  test('calls onFilterMineChange when checkbox is clicked', () => {
    const mockOnFilterMineChange = jest.fn();
    
    render(
      <DailyLedgerView
        date="2025-01-01"
        filterMine={false}
        onFilterMineChange={mockOnFilterMineChange}
        onDateChange={jest.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockOnFilterMineChange).toHaveBeenCalledWith(true);
  });

  test('renders label text for checkbox', () => {
    render(
      <DailyLedgerView
        date="2025-01-01"
        filterMine={false}
        onFilterMineChange={jest.fn()}
        onDateChange={jest.fn()}
      />
    );

    expect(screen.getByText('自分の予約のみ')).toBeInTheDocument();
  });

  test('renders date navigation buttons', () => {
    render(
      <DailyLedgerView
        date="2025-01-01"
        filterMine={false}
        onFilterMineChange={jest.fn()}
        onDateChange={jest.fn()}
      />
    );

    expect(screen.getByText(/前日/)).toBeInTheDocument();
    expect(screen.getByText('今日')).toBeInTheDocument();
    expect(screen.getByText(/翌日/)).toBeInTheDocument();
  });
});
